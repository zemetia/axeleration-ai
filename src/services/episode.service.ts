import {
  normalizeScene,
  normalizeSceneBreakdown,
  readSceneSpecs,
  sceneBreakdownSchema,
  type SceneBreakdown,
} from '@/ai/prompts/script.schema';
import type { ResearchDossier, ResearchFinding } from '@/ai/prompts/research.schema';
import { aiConfig } from '@/config/ai';
import { GRAPH_VERSION, STAGE_ORDER, stagesAfter } from '@/config/pipeline';
import { prisma } from '@/lib/prisma';
import { truncate } from '@/lib/utils';
import type {
  EpisodeStageVO,
  EpisodeVO,
  EpisodeWithStagesVO,
  ResearchDossierPatch,
  SceneSpecInput,
  SceneSpecPatch,
  SceneVO,
  ScriptPatch,
} from '@/types/value-objects';
import type { Episode, EpisodeStage, Prisma, ResearchMode, Scene, StageKind, StageStatus } from '@prisma/client';

/** Derives a short episode title from generated idea/logline text — used only when the user left the title blank. */
export function deriveEpisodeTitle(text: string, maxWords = 8, maxChars = 60): string {
  const words = text.trim().split(/\s+/).slice(0, maxWords).join(' ');
  return truncate(words, maxChars);
}

export interface CreateEpisodeInput {
  title?: string;
  researchMode?: ResearchMode;
  researchNotes?: string;
}

const EPISODE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  GENERATING: 'Generating',
  READY_FOR_REVIEW: 'Ready for Review',
  DONE: 'Done',
  FAILED: 'Failed',
};

const STAGE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  GENERATING: 'Generating',
  READY: 'Ready',
  APPROVED: 'Approved',
  FAILED: 'Failed',
};

function toStageVO(stage: EpisodeStage): EpisodeStageVO {
  return {
    id: stage.id,
    kind: stage.kind,
    status: stage.status,
    statusLabel: STAGE_STATUS_LABELS[stage.status] ?? stage.status,
    attempt: stage.attempt,
    output: (stage.output as Record<string, unknown> | null) ?? null,
    error: stage.error,
    costEstimate: stage.costEstimate ? Number(stage.costEstimate) : null,
    providerMeta: (stage.providerMeta as Record<string, unknown> | null) ?? null,
    startedAt: stage.startedAt ? stage.startedAt.toISOString() : null,
    finishedAt: stage.finishedAt ? stage.finishedAt.toISOString() : null,
  };
}

type SceneSpec = SceneBreakdown['scenes'][number];

/** The SCRIPT stage's stored output is the editable source of truth for scene specs (see `updateSceneSpec`). */
export function parseSceneBreakdown(output: unknown): SceneBreakdown | null {
  const parsed = sceneBreakdownSchema.safeParse(output);
  return parsed.success ? normalizeSceneBreakdown(parsed.data) : null;
}

export type StageWriteFailure = 'not-found' | 'generating' | 'limit';
export type StageWrite<T> = { ok: true; value: T } | { ok: false; reason: StageWriteFailure };

/**
 * A stage the user writes by hand is as finished as one a node produced, so PENDING and FAILED
 * become READY and the Approve button turns on. READY stays READY, and APPROVED stays APPROVED —
 * editing an already-accepted stage must not silently un-accept it. GENERATING never reaches here;
 * `writeStageOutput` refuses it.
 */
export function nextStatusAfterManualWrite(current: StageStatus): StageStatus {
  return current === 'PENDING' || current === 'FAILED' ? 'READY' : current;
}

/**
 * SCRIPT is the one stage where a saved edit is not necessarily something to approve: a logline
 * with no beats leaves `scenesNode` nothing to iterate. Such a draft stays (or reverts to) PENDING
 * so Approve only appears once the breakdown can actually be produced.
 */
export function nextScriptStatus(current: StageStatus, sceneCount: number): StageStatus {
  if (sceneCount === 0) return 'PENDING';
  return nextStatusAfterManualWrite(current);
}

/**
 * Tolerant reader for a SCRIPT stage that may not hold a valid breakdown yet. `parseSceneBreakdown`
 * cannot be used here: `sceneBreakdownSchema` requires `scenes.min(1)`, so a PENDING stage would
 * parse to `null` and the *first* hand-written scene could never be added.
 */
export function readScriptDraft(output: Record<string, unknown> | null): SceneBreakdown {
  const parsed = parseSceneBreakdown(output);
  if (parsed) return parsed;
  return {
    logline: typeof output?.['logline'] === 'string' ? output['logline'] : '',
    scenes: readSceneSpecs(output),
  };
}

/** Append-only: `index` identifies a beat across `Scene` rows and the graph's `scenes` channel, so it is never a position. */
export function appendSceneSpec(script: SceneBreakdown, input: SceneSpecInput): SceneBreakdown {
  const nextIndex = script.scenes.reduce((max, scene) => Math.max(max, scene.index), 0) + 1;
  return {
    ...script,
    scenes: [...script.scenes, normalizeScene({ ...input, index: nextIndex })],
  };
}

/**
 * `reindex` compacts the remaining beats to 1..n — only ever safe before anything has been
 * generated. Once `Scene` rows exist they carry a video, prompt and cost keyed by index, and
 * renumbering would remap all of that onto the wrong beat, so the gap stays instead.
 */
export function removeSceneSpec(script: SceneBreakdown, index: number, opts: { reindex: boolean }): SceneBreakdown {
  const kept = script.scenes.filter((scene) => scene.index !== index);
  return { ...script, scenes: opts.reindex ? kept.map((scene, position) => ({ ...scene, index: position + 1 })) : kept };
}

/**
 * Folds a dossier patch into the RESEARCH stage's output. The nested `research` object is created
 * on demand so *any* research mode can hold hand-written findings, and dropped again when the last
 * one is removed — a mode that never had a dossier reads back exactly as it did before.
 * `summary` is mirrored into both copies so the two the UI reads can never drift.
 */
export function mergeResearchPatch(
  output: Record<string, unknown>,
  patch: ResearchDossierPatch,
): Record<string, unknown> {
  const prior = (output['research'] ?? null) as Record<string, unknown> | null;
  const summary =
    patch.summary !== undefined ? patch.summary.trim() : ((output['summary'] as string | undefined) ?? '');
  const findings = patch.findings ?? ((prior?.['findings'] as ResearchFinding[] | undefined) ?? []);

  const { research: _dropped, ...rest } = output;
  if (findings.length === 0) return { ...rest, summary };

  return {
    ...rest,
    summary,
    research: { visualReferences: [], openQuestions: [], ...(prior ?? {}), summary, findings },
  };
}

/**
 * The one writer every manual edit goes through — it owns the status rule so no caller can forget
 * it. Refuses a stage a node currently holds: `withStage` will call `completeStage` on that row
 * when it finishes and overwrite whatever was typed, and there is no sane way to merge the two.
 */
async function writeStageOutput(
  episodeId: string,
  kind: StageKind,
  build: (output: Record<string, unknown>) => Record<string, unknown> | StageWriteFailure,
  resolveStatus: (current: StageStatus, next: Record<string, unknown>) => StageStatus = nextStatusAfterManualWrite,
): Promise<StageWrite<EpisodeStageVO>> {
  const stage = await prisma.episodeStage.findUnique({ where: { episodeId_kind: { episodeId, kind } } });
  if (!stage) return { ok: false, reason: 'not-found' };
  if (stage.status === 'GENERATING') return { ok: false, reason: 'generating' };

  const next = build((stage.output as Record<string, unknown> | null) ?? {});
  if (typeof next === 'string') return { ok: false, reason: next };

  const updated = await prisma.episodeStage.update({
    where: { episodeId_kind: { episodeId, kind } },
    data: {
      output: next as Prisma.InputJsonValue,
      status: resolveStatus(stage.status, next),
      error: null,
      finishedAt: stage.finishedAt ?? new Date(),
    },
  });
  return { ok: true, value: toStageVO(updated) };
}

/** Every SCRIPT writer shares one status rule — see `nextScriptStatus`. */
function scriptStatus(current: StageStatus, next: Record<string, unknown>): StageStatus {
  return nextScriptStatus(current, readScriptDraft(next).scenes.length);
}

function toSceneVO(episodeId: string, index: number, scene: Scene | null, spec: SceneSpec | null): SceneVO {
  const status = scene?.status ?? 'PENDING';
  return {
    id: scene?.id ?? null,
    episodeId,
    index,
    status,
    statusLabel: STAGE_STATUS_LABELS[status] ?? status,
    attempt: scene?.attempt ?? 0,
    style: spec?.style ?? '',
    setting: spec?.setting ?? '',
    shots: spec?.shots ?? [],
    lighting: spec?.lighting ?? '',
    audio: spec?.audio ?? '',
    dialogue: spec?.dialogue ?? [],
    negative: spec?.negative ?? '',
    durationSeconds: spec?.durationSeconds ?? 0,
    prompt: scene?.prompt ?? null,
    videoUrl: scene?.videoUrl ?? null,
    error: scene?.error ?? null,
    costEstimate: scene?.costEstimate ? Number(scene.costEstimate) : null,
    startedAt: scene?.startedAt ? scene.startedAt.toISOString() : null,
    finishedAt: scene?.finishedAt ? scene.finishedAt.toISOString() : null,
  };
}

function toEpisodeVO(episode: Episode): EpisodeVO {
  return {
    id: episode.id,
    projectId: episode.projectId,
    number: episode.number,
    title: episode.title,
    status: episode.status,
    statusLabel: EPISODE_STATUS_LABELS[episode.status] ?? episode.status,
    researchMode: episode.researchMode,
    researchNotes: episode.researchNotes,
    finalVideoUrl: episode.finalVideoUrl,
    totalCost: episode.totalCost ? Number(episode.totalCost) : null,
    autoPilot: {
      // Running is the *absence* of a stop after a start — derived, never stored, so it cannot
      // drift from the timestamps the loop actually reads.
      isRunning: Boolean(episode.autoPilotStartedAt) && !episode.autoPilotStoppedAt,
      budgetUsd: episode.autoPilotBudget ? Number(episode.autoPilotBudget) : null,
      startedAt: episode.autoPilotStartedAt ? episode.autoPilotStartedAt.toISOString() : null,
      stoppedAt: episode.autoPilotStoppedAt ? episode.autoPilotStoppedAt.toISOString() : null,
      stopReason: episode.autoPilotStopReason,
    },
    createdAt: episode.createdAt.toISOString(),
    updatedAt: episode.updatedAt.toISOString(),
  };
}

export const episodeService = {
  async listByProject(projectId: string): Promise<EpisodeVO[]> {
    const rows = await prisma.episode.findMany({ where: { projectId }, orderBy: { number: 'asc' } });
    return rows.map(toEpisodeVO);
  },

  async get(id: string): Promise<EpisodeWithStagesVO | null> {
    const row = await prisma.episode.findUnique({ where: { id }, include: { stages: true } });
    if (!row) return null;
    return { ...toEpisodeVO(row), stages: row.stages.map(toStageVO) };
  },

  async ownerOf(id: string): Promise<string | null> {
    const row = await prisma.episode.findUnique({
      where: { id },
      select: { project: { select: { ownerId: true } } },
    });
    return row?.project.ownerId ?? null;
  },

  /**
   * Ownership check and fetch in one round trip. The pair `ownerOf()` then `get()` cost two
   * sequential queries on every episode page load and every stages request — the second one
   * could not start until the first returned.
   */
  async getForOwner(id: string, ownerId: string): Promise<EpisodeWithStagesVO | null> {
    const row = await prisma.episode.findFirst({
      where: { id, project: { ownerId } },
      include: { stages: true },
    });
    if (!row) return null;
    return { ...toEpisodeVO(row), stages: row.stages.map(toStageVO) };
  },

  /** Creates the next-numbered episode for the project with all stages seeded as PENDING. */
  async create(projectId: string, input: CreateEpisodeInput = {}): Promise<EpisodeWithStagesVO> {
    const row = await prisma.$transaction(async (tx) => {
      const [last, project] = await Promise.all([
        tx.episode.findFirst({ where: { projectId }, orderBy: { number: 'desc' }, select: { number: true } }),
        tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { defaultResearchMode: true } }),
      ]);
      const number = (last?.number ?? 0) + 1;
      return tx.episode.create({
        data: {
          projectId,
          number,
          title: input.title?.trim() || null,
          researchMode: input.researchMode ?? project.defaultResearchMode,
          researchNotes: input.researchNotes?.trim() || null,
          // Stamped at creation so a later graph rewiring can tell this episode's checkpoint apart
          // from one written against an older shape — see `GRAPH_VERSION`.
          graphVersion: GRAPH_VERSION,
          stages: { create: STAGE_ORDER.map((kind) => ({ kind })) },
        },
        include: { stages: true },
      });
    });
    return { ...toEpisodeVO(row), stages: row.stages.map(toStageVO) };
  },

  /**
   * Arms auto-pilot with a budget. Clearing `autoPilotStoppedAt`/`autoPilotStopReason` is what
   * makes a restart after a stop work — `decideNextStep` reads a set `stoppedAt` as "cancelled",
   * so leaving the previous run's value behind would stop the new one on its first step.
   */
  async startAutoPilot(episodeId: string, budgetUsd: number): Promise<void> {
    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        autoPilotBudget: budgetUsd,
        autoPilotStartedAt: new Date(),
        autoPilotStoppedAt: null,
        autoPilotStopReason: null,
      },
    });
  },

  /**
   * Stops auto-pilot. This does **not** abort a provider call already in flight — that stage is
   * bought and will finish. It stops the loop from approving anything further, which is the only
   * spend still preventable.
   */
  async stopAutoPilot(episodeId: string, reason: string): Promise<void> {
    await prisma.episode.update({
      where: { id: episodeId },
      data: { autoPilotStoppedAt: new Date(), autoPilotStopReason: reason },
    });
  },

  /**
   * Settles the rows a cancelled run leaves behind.
   *
   * Cancelling an Inngest run stops it from taking further steps, but nothing rolls back the
   * `GENERATING` rows the node already wrote — without this they stay GENERATING forever, which
   * the UI renders as a run that never ends and `decideNextStep` reads as "something else is
   * driving this episode".
   *
   * FAILED rather than back to PENDING, because FAILED is the state the room already knows how to
   * recover from: it shows the reason and offers Regenerate. The message says who did it, so it is
   * not confused with a provider error.
   *
   * Racy by nature and deliberately so: a provider call already sent cannot be recalled, and if the
   * node finishes anyway its `completeStage` will overwrite this row with the real output. That is
   * the harmless direction — the user gets work they already paid for.
   */
  async settleCancelledRun(episodeId: string, reason: string): Promise<number> {
    const [stages, scenes] = await prisma.$transaction([
      prisma.episodeStage.updateMany({
        where: { episodeId, status: 'GENERATING' },
        data: { status: 'FAILED', finishedAt: new Date(), error: reason },
      }),
      prisma.scene.updateMany({
        where: { episodeId, status: 'GENERATING' },
        data: { status: 'FAILED', finishedAt: new Date(), error: reason },
      }),
    ]);
    return stages.count + scenes.count;
  },

  /** Backfills the title from the generated idea — never overwrites a user-given name. */
  async setTitleIfEmpty(episodeId: string, title: string): Promise<void> {
    await prisma.episode.updateMany({ where: { id: episodeId, title: null }, data: { title } });
  },

  async stages(episodeId: string): Promise<EpisodeStageVO[]> {
    const rows = await prisma.episodeStage.findMany({
      where: { episodeId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toStageVO);
  },

  /**
   * The IDEA stage's text as stored in the DB. `scriptNode` prefers this over the checkpointed
   * `idea` channel for the same reason `scenesNode` prefers `script()` — the DB row is the one the
   * user can edit, and the two are identical after every AI run.
   */
  async idea(episodeId: string): Promise<string | null> {
    const stage = await prisma.episodeStage.findUnique({
      where: { episodeId_kind: { episodeId, kind: 'IDEA' } },
      select: { output: true },
    });
    const idea = (stage?.output as { idea?: unknown } | null)?.idea;
    return typeof idea === 'string' && idea.trim() ? idea : null;
  },

  /** The RESEARCH stage's stored context, in both the forms downstream prompts want. */
  async research(episodeId: string): Promise<{ summary: string; dossier: ResearchDossier | null }> {
    const stage = await prisma.episodeStage.findUnique({
      where: { episodeId_kind: { episodeId, kind: 'RESEARCH' } },
      select: { output: true },
    });
    const output = (stage?.output as Record<string, unknown> | null) ?? {};
    const research = output['research'];
    return {
      summary: typeof output['summary'] === 'string' ? output['summary'] : '',
      dossier: research && typeof research === 'object' ? (research as ResearchDossier) : null,
    };
  },

  /** The SCRIPT stage's breakdown as stored in the DB — reflects any user edits made from the Scenes room. */
  async script(episodeId: string): Promise<SceneBreakdown | null> {
    const stage = await prisma.episodeStage.findUnique({
      where: { episodeId_kind: { episodeId, kind: 'SCRIPT' } },
      select: { output: true },
    });
    return parseSceneBreakdown(stage?.output);
  },

  /**
   * The dossier the SCENES stage gathered for its own run — distinct from `research()`, which is the
   * RESEARCH *stage*. `scenesNode` reads it back so a gap-filling run with nothing to generate
   * (and therefore nothing to research) rewrites the stage output without blanking it, and
   * `regenerateEpisodeScene` composes a single card against the same context the batch used.
   */
  async sceneResearch(episodeId: string): Promise<ResearchDossier | null> {
    const stage = await prisma.episodeStage.findUnique({
      where: { episodeId_kind: { episodeId, kind: 'SCENES' } },
      select: { output: true },
    });
    const research = (stage?.output as { research?: unknown } | null)?.research;
    return research && typeof research === 'object' ? (research as ResearchDossier) : null;
  },

  async scenes(episodeId: string): Promise<SceneVO[]> {
    const [rows, script] = await Promise.all([
      prisma.scene.findMany({ where: { episodeId }, orderBy: { index: 'asc' } }),
      episodeService.script(episodeId),
    ]);

    const byIndex = new Map(rows.map((row) => [row.index, row]));
    const specByIndex = new Map((script?.scenes ?? []).map((spec) => [spec.index, spec]));
    const indexes = [...new Set([...specByIndex.keys(), ...byIndex.keys()])].sort((a, b) => a - b);

    return indexes.map((index) => toSceneVO(episodeId, index, byIndex.get(index) ?? null, specByIndex.get(index) ?? null));
  },

  /**
   * Edits one scene beat in place. Writes to the SCRIPT stage output rather than the graph
   * checkpoint on purpose: patching the checkpoint would have to be attributed to the SCRIPT node,
   * which rewinds the parked thread's `next` back to SCENES. Instead the generation paths
   * (`scenesNode`, `regenerateEpisodeScene`) read their specs from here, so an edit is picked up by
   * the next regenerate without moving the pipeline.
   */
  async updateSceneSpec(episodeId: string, index: number, patch: SceneSpecPatch): Promise<StageWrite<SceneVO>> {
    // The `Scene` row is untouched by this write, so read it alongside rather than after it.
    const rowPromise = prisma.scene.findUnique({ where: { episodeId_index: { episodeId, index } } });
    // The refusal paths below return without awaiting it; the rejection still surfaces at the await.
    rowPromise.catch(() => undefined);
    const written = await writeStageOutput(
      episodeId,
      'SCRIPT',
      (output) => {
        const script = readScriptDraft(output);
        if (!script.scenes.some((scene) => scene.index === index)) return 'not-found';
        return {
          ...output,
          ...script,
          scenes: script.scenes.map((scene) =>
            scene.index === index
              ? // Through `normalizeScene` so a patched shot list re-derives `durationSeconds`
                // instead of leaving the stored total describing the shots it used to have.
                normalizeScene({
                  ...scene,
                  style: patch.style?.trim() ?? scene.style,
                  setting: patch.setting?.trim() ?? scene.setting,
                  shots: patch.shots ?? scene.shots,
                  lighting: patch.lighting?.trim() ?? scene.lighting,
                  audio: patch.audio?.trim() ?? scene.audio,
                  dialogue: patch.dialogue ?? scene.dialogue,
                  negative: patch.negative?.trim() ?? scene.negative,
                })
              : scene,
          ),
        };
      },
      scriptStatus,
    );
    if (!written.ok) return written;

    const spec = readScriptDraft(written.value.output).scenes.find((scene) => scene.index === index) ?? null;
    return { ok: true, value: toSceneVO(episodeId, index, await rowPromise, spec) };
  },

  /**
   * Whether a stage later than `kind` already holds work — the condition that makes an `asNode`
   * checkpoint rewind destructive, so `alignCheckpointAfterManualWrite` refuses on it.
   *
   * It lives here, and not in `@/ai/graph`, so a caller can ask the question without importing the
   * graph: that module pulls LangGraph and every provider SDK behind it, and a hand-edited beat used
   * to pay for all of it only to be told there was nothing to align.
   */
  async hasDownstreamWork(episodeId: string, kind: StageKind): Promise<boolean> {
    const count = await prisma.episodeStage.count({
      where: {
        episodeId,
        kind: { in: stagesAfter(kind) },
        status: { in: ['READY', 'APPROVED', 'GENERATING'] },
      },
    });
    return count > 0;
  },

  /** Replaces the SCRIPT stage's logline, leaving the beats alone. */
  async updateScript(episodeId: string, patch: ScriptPatch): Promise<StageWrite<EpisodeStageVO>> {
    return writeStageOutput(
      episodeId,
      'SCRIPT',
      (output) => {
        const script = readScriptDraft(output);
        return { ...output, ...script, logline: patch.logline?.trim() ?? script.logline };
      },
      scriptStatus,
    );
  },

  /** Appends a hand-written beat. `scenesNode` upserts `Scene` rows by index, so a new beat needs no other wiring. */
  async addScriptScene(episodeId: string, input: SceneSpecInput): Promise<StageWrite<EpisodeStageVO>> {
    return writeStageOutput(
      episodeId,
      'SCRIPT',
      (output) => {
        const script = readScriptDraft(output);
        if (script.scenes.length >= aiConfig.limits.maxScenesPerEpisode) return 'limit';
        return { ...output, ...appendSceneSpec(script, input) };
      },
      scriptStatus,
    );
  },

  /**
   * Drops a beat from the breakdown and, if it was ever generated, its `Scene` row — otherwise
   * `scenes()` (which unions both index sets) would keep showing a ghost card.
   */
  async deleteScriptScene(episodeId: string, index: number): Promise<StageWrite<EpisodeStageVO>> {
    const generatedCount = await prisma.scene.count({ where: { episodeId } });
    const written = await writeStageOutput(
      episodeId,
      'SCRIPT',
      (output) => {
        const script = readScriptDraft(output);
        if (!script.scenes.some((scene) => scene.index === index)) return 'not-found';
        return { ...output, ...removeSceneSpec(script, index, { reindex: generatedCount === 0 }) };
      },
      scriptStatus,
    );
    if (written.ok) await prisma.scene.deleteMany({ where: { episodeId, index } });
    return written;
  },

  /** Writes the IDEA stage's text by hand — same `{ idea }` shape `ideaNode` produces. */
  async writeIdea(episodeId: string, text: string): Promise<StageWrite<EpisodeStageVO>> {
    return writeStageOutput(episodeId, 'IDEA', (output) => ({ ...output, idea: text.trim() }));
  },

  /**
   * Edits the RESEARCH stage's dossier in place — same "write straight to stage output, no
   * regeneration" approach as `updateSceneSpec`. See `mergeResearchPatch` for how a dossier is
   * created on demand so findings work in every research mode, not just AI_CDP.
   */
  async updateResearchDossier(episodeId: string, patch: ResearchDossierPatch): Promise<StageWrite<EpisodeStageVO>> {
    return writeStageOutput(episodeId, 'RESEARCH', (output) => mergeResearchPatch(output, patch));
  },
};

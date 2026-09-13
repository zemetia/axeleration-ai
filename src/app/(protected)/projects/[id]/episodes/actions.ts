'use server';

// Deep imports, not the `@/assets` barrel: the barrel re-exports `resolver.ts` → `@/services` →
// prisma → `pg`, and this action file is in the client hooks' module graph. See LEARN 2026-08-08.
import { mentionWarning, validateMentions } from '@/assets/validate';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatScenePrompt } from '@/lib/scene-prompt';
import { aiConfig } from '@/config/ai';
import {
  ideaTextSchema,
  sceneSpecInputSchema,
  scriptPatchSchema,
} from '@/lib/validations/episode';
import { assetService, episodeService, projectService } from '@/services';
import type { CreateEpisodeInput, StageWriteFailure } from '@/services/episode.service';
import type {
  SceneSpecInput,
  SceneSpecPatch,
  SceneVO,
  ScriptPatch,
} from '@/types/value-objects';
import type { StageKind } from '@prisma/client';

export interface ActionResult {
  message?: string;
}

/*
 * `@/inngest/client` and `@/inngest/events` are loaded lazily instead of imported at module
 * scope. The client hooks (`useEpisodes`, `useEpisodeStages`, `useScenes`) import this file,
 * so whatever it imports statically lands in the bundler's graph for every episode page —
 * the whole Inngest SDK included. `'use server'` is a runtime boundary, not a compile-time
 * one. See the header comment in `../../actions.ts` for the full story.
 */
async function inngestModules() {
  const [client, events] = await Promise.all([
    import('@/inngest/client'),
    import('@/inngest/events'),
  ]);
  return { inngest: client.inngest, ...events };
}

const WRITE_FAILURES: Record<StageWriteFailure, string> = {
  'not-found': 'That stage does not exist on this episode',
  generating: 'This stage is generating right now — wait for it to finish, then edit',
  limit: `An episode can hold at most ${aiConfig.limits.maxScenesPerEpisode} scenes`,
};

/**
 * After a hand-written stage is saved, tell the parked LangGraph thread its work is done — see
 * `alignCheckpointAfterManualWrite`. Best-effort: the text is already stored either way, so a
 * failure here is a warning, not a failed save.
 */
async function alignThread(
  episodeId: string,
  kind: 'RESEARCH' | 'IDEA' | 'SCRIPT',
): Promise<string | undefined> {
  // The guard first, and deliberately outside the dynamic import: `@/ai/graph/manual-authoring`
  // reaches LangGraph and every provider SDK through `graph.ts`, and past the frontier the answer is
  // "nothing to align" — a text edit should not pay to load a pipeline in order to be told that.
  if (await episodeService.hasDownstreamWork(episodeId, kind)) return undefined;

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: { projectId: true },
  });
  if (!episode) return undefined;
  try {
    const { alignCheckpointAfterManualWrite } = await import('@/ai/graph/manual-authoring');
    await alignCheckpointAfterManualWrite(episodeId, episode.projectId, kind);
    return undefined;
  } catch (err) {
    console.error(`[manual] checkpoint alignment failed for ${episodeId}/${kind}:`, err);
    return 'Saved — but the pipeline could not be advanced, so approving may regenerate this stage.';
  }
}

/**
 * Alignments that have been started but not yet finished, keyed by episode.
 *
 * `alignThread` is cheap to *decide* and expensive to *do*: past the `hasDownstreamWork` guard it
 * dynamically imports `@/ai/graph/manual-authoring`, which reaches LangGraph, the Postgres
 * checkpointer and every provider SDK behind them. Awaiting that inside a beat save charged a prose
 * edit for loading the whole pipeline — seconds in production, and far worse on the first hit in dev
 * where the chunk is compiled on demand.
 *
 * So the save starts it and returns. The one thing that genuinely cannot run before the alignment
 * lands is Approve — an unaligned thread's `next` still points at SCRIPT, so resuming it re-runs the
 * node and overwrites the beats the user just typed. `approveStageAction` therefore awaits whatever
 * is in flight here before queueing its event, which is the only ordering the correctness argument
 * in `alignCheckpointAfterManualWrite` actually needs.
 *
 * Alignments for one episode are chained rather than run in parallel: two `updateState` calls
 * racing on the same thread is not a state the checkpointer should have to reason about.
 */
const pendingAlignments = new Map<string, Promise<string | undefined>>();

function deferAlignThread(episodeId: string, kind: 'RESEARCH' | 'IDEA' | 'SCRIPT'): void {
  const previous = pendingAlignments.get(episodeId) ?? Promise.resolve(undefined);
  const run = previous
    .catch(() => undefined)
    .then(() => alignThread(episodeId, kind))
    .catch((err) => {
      console.error(`[manual] deferred checkpoint alignment failed for ${episodeId}/${kind}:`, err);
      return 'Saved — but the pipeline could not be advanced, so approving may regenerate this stage.';
    });

  pendingAlignments.set(episodeId, run);
  void run.finally(() => {
    // Only clear the entry if nothing newer has replaced it, or a save that lands mid-flight would
    // have its own alignment dropped from the map and Approve would stop waiting for it.
    if (pendingAlignments.get(episodeId) === run) pendingAlignments.delete(episodeId);
  });
}

/**
 * Tells the writer when a beat mentions a handle no asset answers to.
 *
 * T16 built this check (`validateMentions`) and `script.schema.ts` documents beats as verified by
 * it, but nothing ever called it — so a mistyped `@hitmoi` saved silently, rendered as plain text,
 * and reached the video model as the literal characters "@hitmoi" in the shot. The beat editor is
 * where it belongs: it is the one place a person types a handle by hand, which is the whole
 * workflow when the cast was added to the project after the script was written.
 *
 * `lenient` in spirit — a beat that features no asset is perfectly valid, so only an *unresolvable*
 * handle is worth a word. The save itself already succeeded either way.
 */
async function checkBeatMentions(episodeId: string, scene: SceneVO): Promise<string | undefined> {
  // Every block at once — the rendered prompt is exactly the text that reaches the video model, so
  // checking it is checking what actually ships. Cheapest possible exit first: no `@` in the beat
  // means no handle to get wrong, and the roster read never happens.
  const text = formatScenePrompt(scene);
  if (!text.includes('@')) return undefined;

  const episode = await prisma.episode.findUnique({ where: { id: episodeId }, select: { projectId: true } });
  if (!episode) return undefined;

  const roster = await assetService.list(episode.projectId);
  return mentionWarning(validateMentions(text, roster)) ?? undefined;
}

async function requireEpisodeOwner(episodeId: string): Promise<boolean> {
  const session = await requireAuth();
  const ownerId = await episodeService.ownerOf(episodeId);
  return Boolean(ownerId) && ownerId === session.user.id;
}

export async function generateEpisodeAction(
  projectId: string,
  input: CreateEpisodeInput = {},
): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await projectService.ownerOf(projectId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  const episode = await episodeService.create(projectId, input);
  // projectId rides along so Inngest can cap concurrency per project (see `generate-episode`).
  const { inngest, episodeGenerate } = await inngestModules();
  await inngest.send(episodeGenerate.create({ episodeId: episode.id, projectId }));
  return {};
}

export async function approveStageAction(
  episodeId: string,
  stage: StageKind,
): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await episodeService.ownerOf(episodeId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  // The ordering guarantee a hand-edited stage depends on — see `pendingAlignments`.
  const alignment = await pendingAlignments.get(episodeId);

  const { inngest, stageApprove } = await inngestModules();
  await inngest.send(stageApprove.create({ episodeId, stage }));
  return alignment ? { message: alignment } : {};
}

/**
 * Re-runs one stage. `scope` is SCENES-only: `'all'` regenerates every beat, `'missing'` generates
 * only the beats that have no clip yet — the batch counterpart to generating scenes card by card.
 */
export async function regenerateStageAction(
  episodeId: string,
  stage: StageKind,
  note?: string,
  scope?: 'missing' | 'all',
): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await episodeService.ownerOf(episodeId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  const current = await prisma.episodeStage.findUnique({
    where: { episodeId_kind: { episodeId, kind: stage } },
  });
  if (current && current.attempt >= aiConfig.limits.maxRegenPerStage) {
    return { message: 'Regenerate limit reached for this stage' };
  }

  const { inngest, stageRegenerate } = await inngestModules();
  await inngest.send(stageRegenerate.create({ episodeId, stage, note, scope }));
  return {};
}

/**
 * The regenerate cap applies to any action that re-runs a stage, not only the one called
 * "Regenerate" — Refine and Re-research both bump `attempt` through `withStage` and both bill a
 * model call. The Inngest functions guard again server-side; this is the copy the user actually
 * reads, since an event rejected inside a function surfaces as a failed run rather than a message.
 */
async function regenerateBlocked(episodeId: string, stage: StageKind): Promise<string | null> {
  const row = await prisma.episodeStage.findUnique({
    where: { episodeId_kind: { episodeId, kind: stage } },
  });
  if (row && row.attempt >= aiConfig.limits.maxRegenPerStage) {
    return `Regenerate limit reached for ${stage.toLowerCase()}`;
  }
  return null;
}

/**
 * Improves the idea that is there instead of replacing it — `ideaMode: 'refine'`. The distinction
 * from `regenerateStageAction(_, 'IDEA')` is the whole point: that one writes a different episode,
 * this one keeps the premise, the cast and the ending and changes what the note asks for.
 */
export async function refineIdeaAction(episodeId: string, note?: string): Promise<ActionResult> {
  if (!(await requireEpisodeOwner(episodeId))) return { message: 'Forbidden' };

  const blocked = await regenerateBlocked(episodeId, 'IDEA');
  if (blocked) return { message: blocked };

  const { inngest, ideaRefine } = await inngestModules();
  await inngest.send(ideaRefine.create({ episodeId, note }));
  return {};
}

/**
 * Improves the scene breakdown that is there instead of cutting a new one — `scriptMode: 'refine'`.
 * The distinction from `regenerateStageAction(_, 'SCRIPT')` is the whole point: that one throws away
 * every beat and writes a different script, this one keeps the count, order and dialogue and changes
 * only what the note asks for.
 */
export async function refineScriptAction(episodeId: string, note?: string): Promise<ActionResult> {
  if (!(await requireEpisodeOwner(episodeId))) return { message: 'Forbidden' };

  const blocked = await regenerateBlocked(episodeId, 'SCRIPT');
  if (blocked) return { message: blocked };

  const { inngest, scriptRefine } = await inngestModules();
  await inngest.send(scriptRefine.create({ episodeId, note }));
  return {};
}

/**
 * Researches again and then rewrites the idea from what came back — one action, because the two
 * halves are only correct together (see `rerun-research.ts`). Both stages are capped, and both are
 * checked here so the refusal is a message rather than a failed run.
 */
export async function rerunResearchAction(
  episodeId: string,
  note?: string,
): Promise<ActionResult> {
  if (!(await requireEpisodeOwner(episodeId))) return { message: 'Forbidden' };

  const blocked = (await regenerateBlocked(episodeId, 'RESEARCH')) ?? (await regenerateBlocked(episodeId, 'IDEA'));
  if (blocked) return { message: blocked };

  const { inngest, ideaRerunResearch } = await inngestModules();
  await inngest.send(ideaRerunResearch.create({ episodeId, note }));
  return {};
}

/**
 * Edits one scene beat from its card — no generation, no cost. Returns the written beat so the
 * caller can put it straight into its cache instead of refetching the whole list to see one edit.
 */
export async function updateSceneAction(
  episodeId: string,
  sceneIndex: number,
  patch: SceneSpecPatch,
): Promise<ActionResult & { scene?: SceneVO }> {
  if (!(await requireEpisodeOwner(episodeId))) return { message: 'Forbidden' };

  const written = await episodeService.updateSceneSpec(episodeId, sceneIndex, patch);
  if (!written.ok) return { message: WRITE_FAILURES[written.reason] };

  // The two roster reads behind this are indexed and usually skipped outright (most beats contain
  // no `@`), so it stays on the path — the warning is about the text being saved and belongs with
  // the save. The alignment does not: it is started here and awaited by Approve instead.
  const message = await checkBeatMentions(episodeId, written.value);
  deferAlignThread(episodeId, 'SCRIPT');

  return { ...(message ? { message } : {}), scene: written.value };
}

/** Writes the IDEA stage by hand instead of generating it. */
export async function writeIdeaAction(episodeId: string, text: string): Promise<ActionResult> {
  if (!(await requireEpisodeOwner(episodeId))) return { message: 'Forbidden' };

  const parsed = ideaTextSchema.safeParse(text);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Invalid idea' };

  const written = await episodeService.writeIdea(episodeId, parsed.data);
  if (!written.ok) return { message: WRITE_FAILURES[written.reason] };
  return { message: await alignThread(episodeId, 'IDEA') };
}

/** Rewrites the SCRIPT stage's logline — the beats are edited one card at a time. */
export async function updateScriptAction(
  episodeId: string,
  patch: ScriptPatch,
): Promise<ActionResult> {
  if (!(await requireEpisodeOwner(episodeId))) return { message: 'Forbidden' };

  const parsed = scriptPatchSchema.safeParse(patch);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Invalid script edit' };

  const written = await episodeService.updateScript(episodeId, parsed.data);
  if (!written.ok) return { message: WRITE_FAILURES[written.reason] };
  return { message: await alignThread(episodeId, 'SCRIPT') };
}

/** Appends a hand-written beat to the scene breakdown. */
export async function addScriptSceneAction(
  episodeId: string,
  input: SceneSpecInput,
): Promise<ActionResult> {
  if (!(await requireEpisodeOwner(episodeId))) return { message: 'Forbidden' };

  const parsed = sceneSpecInputSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Invalid scene' };

  const written = await episodeService.addScriptScene(episodeId, parsed.data);
  if (!written.ok) return { message: WRITE_FAILURES[written.reason] };
  return { message: await alignThread(episodeId, 'SCRIPT') };
}

/** Removes a beat from the breakdown, along with its generated `Scene` row if it has one. */
export async function deleteScriptSceneAction(
  episodeId: string,
  sceneIndex: number,
): Promise<ActionResult> {
  if (!(await requireEpisodeOwner(episodeId))) return { message: 'Forbidden' };

  const written = await episodeService.deleteScriptScene(episodeId, sceneIndex);
  if (!written.ok) return { message: WRITE_FAILURES[written.reason] };
  return { message: await alignThread(episodeId, 'SCRIPT') };
}

export async function regenerateSceneAction(
  episodeId: string,
  sceneIndex: number,
  note?: string,
): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await episodeService.ownerOf(episodeId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: { projectId: true },
  });
  if (!episode) return { message: 'Not found' };

  const scene = await prisma.scene.findUnique({
    where: { episodeId_index: { episodeId, index: sceneIndex } },
  });
  if (scene && scene.attempt >= aiConfig.limits.maxRegenPerStage) {
    return { message: 'Regenerate limit reached for this scene' };
  }

  const { inngest, sceneRegenerate } = await inngestModules();
  await inngest.send(
    sceneRegenerate.create({ episodeId, projectId: episode.projectId, sceneIndex, note }),
  );
  return {};
}

/**
 * Arms auto-pilot and starts it. The budget is a hard precondition, not a suggestion: the loop
 * refuses to approve a stage whose forecast would carry the running total past it, so a missing or
 * nonsensical value must be rejected here rather than defaulted.
 *
 * Restarting after a stop is the same call — `startAutoPilot` clears the previous stop reason.
 */
export async function startAutoPilotAction(
  episodeId: string,
  budgetUsd: number,
): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await episodeService.ownerOf(episodeId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
    return { message: 'Set a budget above $0 before starting auto-pilot' };
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: { projectId: true },
  });
  if (!episode) return { message: 'Not found' };

  await episodeService.startAutoPilot(episodeId, budgetUsd);

  const { inngest, autoPilotStart } = await inngestModules();
  await inngest.send(autoPilotStart.create({ episodeId, projectId: episode.projectId }));
  return {};
}

/**
 * Stops auto-pilot from approving anything further. A stage already generating is already paid for
 * and will finish — this is the difference between "stop spending more" and "cancel the run",
 * and the dialog says so.
 */
export async function stopAutoPilotAction(episodeId: string): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await episodeService.ownerOf(episodeId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  await episodeService.stopAutoPilot(episodeId, 'Stopped by you.');
  return {};
}

/**
 * Stops everything running on this episode.
 *
 * Auto-pilot goes first and is the one step that must not be reordered: leave it armed and it
 * approves the next stage the instant the current run disappears, which is the opposite of Stop.
 *
 * The Inngest cancel is sent *last* and is best-effort. Stop is pressed precisely when things are
 * already going wrong, so it must not be hostage to the event bus being reachable — an unreachable
 * Inngest would otherwise throw here and leave the rows GENERATING forever, i.e. a Stop button that
 * visibly does nothing. Settling the rows is what the user sees, so that happens first and
 * unconditionally; the event only stops steps that have not run yet.
 *
 * What this cannot do is un-spend a provider call already in flight — the dialog says so. It stops
 * the *next* one, which is the only cost still preventable.
 */
export async function cancelEpisodeRunAction(episodeId: string): Promise<ActionResult> {
  const session = await requireAuth();
  const ownerId = await episodeService.ownerOf(episodeId);
  if (!ownerId || ownerId !== session.user.id) {
    return { message: 'Forbidden' };
  }

  await episodeService.stopAutoPilot(episodeId, 'Stopped by you.');
  await episodeService.settleCancelledRun(episodeId, 'Cancelled by you.');

  const { syncEpisodeStatus } = await import('@/inngest/episode-status');
  await syncEpisodeStatus(episodeId);

  try {
    const { inngest, runCancel } = await inngestModules();
    await inngest.send(runCancel.create({ episodeId }));
  } catch (err) {
    console.error(`[pipeline] cancel event failed for episode ${episodeId}:`, err);
    return {
      message:
        'Stopped here, but the run could not be signalled — it may finish the step it is on. Reload in a minute to check.',
    };
  }

  return {};
}

import type { SceneBreakdown } from '@/ai/prompts/script.schema';
import type { ResearchDossier } from '@/ai/prompts/research.schema';
import { formatResearchDossier, runResearchAgent } from '@/ai/research/research-agent';
import { buildAssetRoster } from '@/assets/roster';
import { aiConfig } from '@/config/ai';
import { prisma } from '@/lib/prisma';
import { sceneHeadline } from '@/lib/scene-prompt';
import type { ProjectModelConfig } from '@/providers/types';
import { assetService, contextService, episodeService, projectService } from '@/services';
import type { Prisma } from '@prisma/client';

import { mapWithConcurrency } from '../concurrency';
import { generateScene } from '../scene-generation';
import { withSceneRow } from '../scene-io';
import { updateStageActivity, withStage } from '../stage-io';
import type { EpisodeGraphState, EpisodeGraphUpdate, SceneResult } from '../state';

interface GatherResearchInput {
  episodeId: string;
  projectId: string;
  script: SceneBreakdown;
  characterBibleText: string;
  continuitySummary: string;
  modelConfig?: ProjectModelConfig;
}

/**
 * Runs the on-demand research agent (not a pipeline stage — see `src/ai/research/`) once per
 * SCENES run, covering the whole episode rather than per-scene, to bound search cost/latency.
 * Best-effort: if the local Chrome for `web_search`/`fetch_page` isn't reachable, scenes still
 * compose — just without grounded research context.
 */
async function gatherResearch(input: GatherResearchInput): Promise<ResearchDossier | null> {
  const target = [
    `Logline: ${input.script.logline}`,
    'Scenes:',
    ...input.script.scenes.map((scene) => `${scene.index}. ${sceneHeadline(scene)}`),
  ].join('\n');

  try {
    return await runResearchAgent({
      projectId: input.projectId,
      goal: "Ground this episode's scenes in real, source-backed detail before they're turned into generation prompts.",
      target,
      baseline: `Continuity so far: ${input.continuitySummary}\nCharacter bible: ${input.characterBibleText}`,
      modelConfig: input.modelConfig,
      onActivity: (activity) => updateStageActivity(input.episodeId, 'SCENES', activity),
    });
  } catch (err) {
    console.error('[research] skipping — agent could not complete (is local Chrome running with a debug port?):', err);
    return null;
  }
}

/**
 * Clips that already exist and must not be paid for a second time: beats the user generated one card
 * at a time from the Scenes room (`regenerateEpisodeScene`), or survivors of a batch where only some
 * beats failed. Keyed by scene index, which is an identity and never a position.
 */
async function existingClips(episodeId: string): Promise<Map<number, ExistingClip>> {
  const rows = await prisma.scene.findMany({
    where: { episodeId, status: 'READY' },
    select: { index: true, videoUrl: true, costEstimate: true },
  });
  return new Map(
    rows.flatMap((row) =>
      row.videoUrl
        ? [[row.index, { videoUrl: row.videoUrl, costEstimate: Number(row.costEstimate ?? 0) }] as const]
        : [],
    ),
  );
}

interface ExistingClip {
  videoUrl: string;
  costEstimate: number;
}

export async function scenesNode(state: EpisodeGraphState): Promise<EpisodeGraphUpdate> {
  const { episodeId, projectId } = state;
  // The stored SCRIPT output wins over the checkpointed channel: it's identical after every SCRIPT
  // run, and diverges only when the user edited a beat from the Scenes room (see `updateSceneSpec`).
  const script = (await episodeService.script(episodeId)) ?? state.script;
  if (!script) throw new Error('scenesNode requires a script (SCRIPT stage must run first)');

  // `'all'` comes only from an explicit "Regenerate all scenes"; every other entry into this node
  // (Approve, or "Generate remaining") fills the gaps and keeps the clips that are already paid for.
  const reused = state.sceneScope === 'all' ? new Map<number, ExistingClip>() : await existingClips(episodeId);
  const todo = script.scenes.filter((scene) => !reused.has(scene.index));
  // The stage row's dossier survives a gap-filling run that has nothing to research, so approving a
  // fully hand-generated episode doesn't blank the research the individual scenes were composed from.
  const storedDossier = todo.length > 0 ? null : await episodeService.sceneResearch(episodeId);

  const { scenes, costTotal } = await withStage(episodeId, 'SCENES', async () => {
    const [project, bible, continuity, assets] = await Promise.all([
      projectService.get(projectId),
      contextService.getCharacterBible(projectId),
      contextService.getContinuityState(projectId),
      assetService.list(projectId),
    ]);
    if (!project) throw new Error(`Project ${projectId} not found`);
    const modelConfig = project.modelConfig as ProjectModelConfig | undefined;
    const characterBibleText = bible ? JSON.stringify(bible.lockedTraits) : 'none';
    const assetRosterText = buildAssetRoster(assets);

    // Nothing left to generate means nothing left to research — the run exists only to declare the
    // stage finished over clips that already landed, so it must not spend on a fresh dossier.
    const dossier =
      todo.length === 0
        ? storedDossier
        : await gatherResearch({
            episodeId,
            projectId,
            script,
            characterBibleText,
            continuitySummary: continuity.summary || '(none)',
            modelConfig,
          });
    const researchContext = formatResearchDossier(dossier);
    const styleConfigText = project.styleConfig ? JSON.stringify(project.styleConfig) : 'none';

    let costSum = 0;
    const generatedResults = await mapWithConcurrency(todo, aiConfig.limits.sceneConcurrency, async (scene): Promise<SceneResult> => {
      const generated = await withSceneRow(episodeId, scene.index, async () => {
        const output = await generateScene({
          projectId,
          scene,
          characterBibleText,
          assetRosterText,
          styleConfigText,
          aspectRatio: project.aspectRatio,
          resolution: project.resolution,
          researchContext,
          revisionNote: state.regenerateNote || '(none)',
          modelConfig,
        });
        return {
          result: output,
          prompt: output.prompt,
          videoUrl: output.videoUrl,
          costEstimate: output.costEstimate,
          providerMeta: output.providerMeta as Prisma.InputJsonValue,
        };
      });
      costSum += generated.costEstimate;
      return { index: generated.index, videoUrl: generated.videoUrl };
    });

    // The channel must carry every beat, not just this run's — RENDER stitches from it, so a reused
    // clip missing here would be dropped from the cut. Ordered by index for the same reason.
    const results = [
      ...generatedResults,
      ...[...reused].map(([index, clip]): SceneResult => ({ index, videoUrl: clip.videoUrl })),
    ].sort((a, b) => a.index - b.index);

    // `completeStage` overwrites `costEstimate` rather than incrementing it, so the reused clips'
    // cost has to be added back in — otherwise a gap-filling run erases what the per-scene
    // `addStageCost` calls recorded and the batch looks cheaper than it was.
    const reusedCost = [...reused.values()].reduce((sum, clip) => sum + clip.costEstimate, 0);

    return {
      result: { scenes: results, costTotal: costSum },
      output: { scenes: results, research: dossier } as unknown as Prisma.InputJsonValue,
      costEstimate: Number((costSum + reusedCost).toFixed(4)),
    };
  });

  return { scenes, costTotal, regenerateNote: '', sceneScope: 'missing' };
}

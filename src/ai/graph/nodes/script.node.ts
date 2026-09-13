import { refineScriptPrompt } from '@/ai/prompts/refine-script.prompt';
import { scriptPrompt } from '@/ai/prompts/script.prompt';
import { normalizeSceneBreakdown, sceneBreakdownSchema, type SceneBreakdown } from '@/ai/prompts/script.schema';
import { getChatModel } from '@/ai/router/model-router';
import { buildAssetRoster } from '@/assets/roster';
import { estimateScenes } from '@/lib/scene-estimate';
import { assetService, contextService, episodeService, projectService } from '@/services';
import type { ProjectModelConfig } from '@/providers/types';
import type { Prisma } from '@prisma/client';

import { withStage } from '../stage-io';
import type { EpisodeGraphState, EpisodeGraphUpdate, ScriptMode } from '../state';

export async function scriptNode(state: EpisodeGraphState): Promise<EpisodeGraphUpdate> {
  const { episodeId, projectId } = state;
  // Same precedence as `scenesNode`: the stored IDEA output carries the user's edits (or is the
  // whole idea, when they wrote it by hand instead of generating it).
  const idea = (await episodeService.idea(episodeId)) ?? state.idea;
  if (!idea) throw new Error('scriptNode requires an IDEA (generate or write it first)');

  // Refine needs something to refine. The stored row wins over the channel — same DB-before-channel
  // precedence as `ideaNode` — so hand-edited beats are what get revised, not the last generated
  // batch. Nothing stored means the button was pressed in a state where it has no meaning; fall
  // through to a fresh write.
  const currentScript = state.scriptMode === 'refine' ? ((await episodeService.script(episodeId)) ?? state.script) : undefined;
  const mode: ScriptMode = state.scriptMode === 'refine' && currentScript ? 'refine' : 'fresh';

  const script = await withStage(episodeId, 'SCRIPT', async () => {
    const [project, bible, assets] = await Promise.all([
      projectService.get(projectId),
      contextService.getCharacterBible(projectId),
      assetService.list(projectId),
    ]);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const targetScenes = estimateScenes({
      targetTotalSeconds: project.targetTotalSeconds,
      sceneDurationMin: project.sceneDurationMin,
      sceneDurationMax: project.sceneDurationMax,
    });

    // `method: 'jsonMode'` — bare `.withStructuredOutput()` defaults to the strict
    // `response_format: json_schema` wire format for any model not literally prefixed `gpt-3`/`gpt-4`,
    // which covers every non-OpenAI model this app routes through (DeepSeek direct, and every
    // Gemini/GLM/Qwen/etc. id in the Sumopod catalog); most of those APIs 400 on it ("response_format
    // type is unavailable", confirmed against DeepSeek — same fix as `research-agent.ts`). `jsonMode`
    // sends `{ type: 'json_object' }` instead, which is why the shape is now spelled out in the prompt.
    const model = (
      await getChatModel('script', { projectId, project: project.modelConfig as ProjectModelConfig | undefined })
    ).withStructuredOutput(sceneBreakdownSchema, { method: 'jsonMode' });

    const characterBible = bible ? JSON.stringify(bible.lockedTraits) : 'no character bible yet';
    const assetRoster = buildAssetRoster(assets);

    const raw =
      mode === 'refine' && currentScript
        ? await refineScriptPrompt.pipe(model).invoke({
            idea,
            characterBible,
            assetRoster,
            targetTotalSeconds: project.targetTotalSeconds,
            aspectRatio: project.aspectRatio,
            currentScript: JSON.stringify(currentScript),
            userNote: state.regenerateNote || '(none)',
          })
        : await scriptPrompt.pipe(model).invoke({
            idea,
            characterBible,
            assetRoster,
            targetScenes,
            targetTotalSeconds: project.targetTotalSeconds,
            aspectRatio: project.aspectRatio,
            revisionNote: state.regenerateNote || '(none)',
          });
    // The structured-output type mirrors the schema's *input* shape (every block optional
    // pre-default), and a model asked for blocks will still occasionally answer in the old
    // description/mood form. `normalizeSceneBreakdown` is the one place that settles both, so
    // downstream nodes only ever see a canonical beat with its duration derived from its shots.
    const breakdown: SceneBreakdown = normalizeSceneBreakdown(sceneBreakdownSchema.parse(raw));

    return { result: breakdown, output: breakdown as unknown as Prisma.InputJsonValue };
  });

  // Reset to `'fresh'`, same consume-and-clear contract as `regenerateNote`: a refine requested
  // once must not turn the next Regenerate into another refine.
  return { script, scriptMode: 'fresh', regenerateNote: '' };
}

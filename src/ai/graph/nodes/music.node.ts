import { musicPrompt } from '@/ai/prompts/music.prompt';
import { getChatModel } from '@/ai/router/model-router';
import { readPipelineConfig } from '@/config/pipeline-config';
import { providerRegistry } from '@/providers/registry';
import type { ProjectModelConfig } from '@/providers/types';
import { apiKeyService, projectService } from '@/services';

import { withStage } from '../stage-io';
import type { EpisodeGraphState, EpisodeGraphUpdate } from '../state';

export async function musicNode(state: EpisodeGraphState): Promise<EpisodeGraphUpdate> {
  const { episodeId, projectId } = state;
  if (!state.script) throw new Error('musicNode requires state.script (SCRIPT stage must run first)');
  const script = state.script;

  const musicUrl = await withStage(episodeId, 'MUSIC', async () => {
    const project = await projectService.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    // See `voice.node.ts` — same switch, checked before the brief is written so neither the LLM
    // call nor the music generation is billed while audio is off.
    if (readPipelineConfig(project.pipelineConfig).skipAudio) {
      return { result: undefined, output: { skipped: true, reason: 'audio disabled for this project (skipAudio)' }, costEstimate: 0 };
    }

    const modelConfig = project.modelConfig as ProjectModelConfig | undefined;

    const model = await getChatModel('music', { projectId, project: modelConfig });
    // A beat's feel now lives in its [STYLE] and [LIGHTING] blocks rather than a one-word mood, so
    // the brief is written from those — deduplicated, since a series usually repeats a look and a
    // list of twelve identical styles says no more than one does.
    const moods = [
      ...new Set(script.scenes.flatMap((scene) => [scene.style, scene.lighting]).map((text) => text.trim()).filter(Boolean)),
    ];
    const brief = await musicPrompt.pipe(model).invoke({
      logline: script.logline,
      moods: moods.length > 0 ? moods.join(', ') : 'neutral, unobtrusive',
    });
    const briefText = typeof brief.content === 'string' ? brief.content : JSON.stringify(brief.content);

    const result = await providerRegistry.run(
      'music',
      { capability: 'music', prompt: briefText, durationSeconds: project.targetTotalSeconds },
      {
        project: modelConfig,
        resolveApiKey: (provider, apiKeyId) => apiKeyService.getDecrypted(projectId, provider, apiKeyId).then((k) => k ?? ''),
      },
    );
    const output = result.outputs[0];
    if (!output) throw new Error('MUSIC: provider returned no output');

    return {
      result: output.url,
      output: { brief: briefText, url: output.url },
      costEstimate: result.costEstimate,
      providerMeta: result.providerMeta,
    };
  });

  return { musicUrl, regenerateNote: '' };
}

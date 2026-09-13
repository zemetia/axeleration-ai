import { voiceLinesSchema, voicePrompt } from '@/ai/prompts/voice.prompt';
import { getChatModel } from '@/ai/router/model-router';
import { readPipelineConfig } from '@/config/pipeline-config';
import { providerRegistry } from '@/providers/registry';
import type { ProjectModelConfig } from '@/providers/types';
import { apiKeyService, assetService, episodeService, projectService } from '@/services';

import { withStage } from '../stage-io';
import type { EpisodeGraphState, EpisodeGraphUpdate } from '../state';

export async function voiceNode(state: EpisodeGraphState): Promise<EpisodeGraphUpdate> {
  const { episodeId, projectId } = state;
  // The stored breakdown wins over the checkpointed channel — it carries beat edits and any
  // hand-written scenes, and is identical to the channel after every SCRIPT run.
  const script = (await episodeService.script(episodeId)) ?? state.script;
  if (!script) throw new Error('voiceNode requires a SCRIPT (generate or write it first)');

  const voiceUrls = await withStage(episodeId, 'VOICE', async () => {
    const dialogue = script.scenes.flatMap((scene) => scene.dialogue);
    if (dialogue.length === 0) {
      return { result: [] as string[], output: { skipped: true, reason: 'no dialogue in script' } };
    }

    const [project, voiceAssets] = await Promise.all([projectService.get(projectId), assetService.list(projectId, { type: 'VOICE' })]);
    if (!project) throw new Error(`Project ${projectId} not found`);

    // Checked after the project load (the reason has to be recorded against a real project) but
    // before any model call, so the stage costs nothing while audio is switched off.
    if (readPipelineConfig(project.pipelineConfig).skipAudio) {
      return { result: [] as string[], output: { skipped: true, reason: 'audio disabled for this project (skipAudio)' }, costEstimate: 0 };
    }

    const voiceAsset = voiceAssets[0];
    if (!voiceAsset?.voiceId) {
      return { result: [] as string[], output: { skipped: true, reason: 'no VOICE asset configured for this project' } };
    }

    const modelConfig = project.modelConfig as ProjectModelConfig | undefined;
    // `method: 'jsonMode'` — see `script.node.ts` for why bare `.withStructuredOutput()` 400s on
    // DeepSeek and most Sumopod-routed models ("response_format type is unavailable").
    const model = (await getChatModel('voice', { projectId, project: modelConfig })).withStructuredOutput(voiceLinesSchema, {
      method: 'jsonMode',
    });
    const normalized = await voicePrompt.pipe(model).invoke({ scriptDialogue: JSON.stringify(dialogue) });
    const fullText = normalized.lines.map((line) => line.text).join(' ');

    const result = await providerRegistry.run(
      'tts',
      { capability: 'tts', prompt: fullText, voiceId: voiceAsset.voiceId },
      {
        project: modelConfig,
        resolveApiKey: (provider, apiKeyId) => apiKeyService.getDecrypted(projectId, provider, apiKeyId).then((k) => k ?? ''),
      },
    );
    const output = result.outputs[0];
    if (!output) throw new Error('VOICE: provider returned no output');

    return {
      result: [output.url],
      output: { lines: normalized.lines, url: output.url },
      costEstimate: result.costEstimate,
      providerMeta: result.providerMeta,
    };
  });

  return { voiceUrls, regenerateNote: '' };
}

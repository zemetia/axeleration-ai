import { assertFfmpegAvailable } from '@/lib/ffmpeg';
import { keyFromUrl } from '@/lib/storage';
import { providerRegistry } from '@/providers/registry';
import type { ProjectModelConfig } from '@/providers/types';
import { apiKeyService, episodeService, projectService } from '@/services';

import { withStage } from '../stage-io';
import type { EpisodeGraphState, EpisodeGraphUpdate } from '../state';

function aspectRatioFor(aspectRatio: string): '9:16' | '16:9' | '1:1' {
  if (aspectRatio === 'R16_9') return '16:9';
  if (aspectRatio === 'R1_1') return '1:1';
  return '9:16';
}

function resolutionFor(resolution: string): '720p' | '1080p' | '4K' {
  if (resolution === 'P720') return '720p';
  if (resolution === 'P4K') return '4K';
  return '1080p';
}

export async function renderNode(state: EpisodeGraphState): Promise<EpisodeGraphUpdate> {
  const { episodeId, projectId } = state;

  // Before `withStage`, so a machine with no ffmpeg fails here rather than after materializing
  // every clip — by this point the episode's whole generation bill has already been paid.
  await assertFfmpegAvailable();

  /*
   * The cut is stitched from `Scene` rows, not from the `scenes` channel this node used to read.
   *
   * The channel is written by `scenesNode` and patched out-of-band by `regenerateEpisodeScene` —
   * which deliberately skips that patch when the batch has not run (see the comment at the foot of
   * `graph.ts`). So a user who generated every beat one card at a time from the Scenes room has
   * correct rows and an empty channel, and RENDER would have refused to run. The rows are the
   * record of what was generated; the channel is a cache of one particular run.
   */
  const scenes = await episodeService.scenes(episodeId);
  if (scenes.length === 0) throw new Error('renderNode: this episode has no scenes (run SCRIPT and SCENES first)');

  const missing = scenes.filter((scene) => scene.status !== 'READY' || !scene.videoUrl).map((scene) => scene.index);
  if (missing.length > 0) {
    throw new Error(
      `renderNode: no clip yet for scene ${missing.join(', ')} — generate ${missing.length === 1 ? 'it' : 'them'} before rendering`,
    );
  }

  const finalVideoUrl = await withStage(episodeId, 'RENDER', async () => {
    const project = await projectService.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    const modelConfig = project.modelConfig as ProjectModelConfig | undefined;

    const sceneKeys = scenes.map((scene) => keyFromUrl(scene.videoUrl as string));
    const voiceKey = state.voiceUrls?.[0] ? keyFromUrl(state.voiceUrls[0]) : undefined;
    const musicKey = state.musicUrl ? keyFromUrl(state.musicUrl) : undefined;

    const result = await providerRegistry.run(
      'video-assembly',
      {
        capability: 'video-assembly',
        aspectRatio: aspectRatioFor(project.aspectRatio),
        resolution: resolutionFor(project.resolution),
        input: { sceneKeys, voiceKey, musicKey },
      },
      {
        project: modelConfig,
        resolveApiKey: (provider, apiKeyId) => apiKeyService.getDecrypted(projectId, provider, apiKeyId).then((k) => k ?? ''),
      },
    );
    const output = result.outputs[0];
    if (!output) throw new Error('RENDER: provider returned no output');

    return {
      result: output.url,
      output: { url: output.url, sceneCount: sceneKeys.length },
      costEstimate: result.costEstimate,
      providerMeta: result.providerMeta,
    };
  });

  return { finalVideoUrl, regenerateNote: '' };
}

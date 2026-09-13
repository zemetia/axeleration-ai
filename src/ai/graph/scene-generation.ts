import type { SceneSpec } from '@/ai/prompts/script.schema';
import { sceneComposePrompt } from '@/ai/prompts/scene-compose.prompt';
import { getChatModel } from '@/ai/router/model-router';
import { assetResolver } from '@/assets/resolver';
import { formatScenePrompt, shotWindows } from '@/lib/scene-prompt';
import { providerRegistry } from '@/providers/registry';
import type { AssetRef, ProjectModelConfig } from '@/providers/types';
import { apiKeyService } from '@/services';
import type { AspectRatio, Resolution } from '@prisma/client';

/**
 * Composes one scene's prompt (character bible + style + research + `@mention` resolution) and
 * generates its video. This is the unit of work shared by the SCENES stage's fan-out
 * (`nodes/scenes.node.ts`) and a single targeted scene regenerate (`regenerateEpisodeScene` in
 * `graph.ts`) — extracted so a per-scene redo runs exactly the same generation path as the batch.
 */

export interface GenerateSceneInput {
  projectId: string;
  scene: SceneSpec;
  characterBibleText: string;
  /** Built once per run by the caller (`buildAssetRoster`) — one roster read per scene would be N identical queries. */
  assetRosterText: string;
  styleConfigText: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  researchContext: string;
  revisionNote: string;
  modelConfig?: ProjectModelConfig;
}

export interface GeneratedScene {
  index: number;
  videoUrl: string;
  prompt: string;
  costEstimate: number;
  providerMeta?: Record<string, unknown>;
}

function aspectRatioFor(aspectRatio: AspectRatio): '9:16' | '16:9' | '1:1' {
  if (aspectRatio === 'R16_9') return '16:9';
  if (aspectRatio === 'R1_1') return '1:1';
  return '9:16';
}

function resolutionFor(resolution: Resolution): '720p' | '1080p' | '4K' {
  if (resolution === 'P720') return '720p';
  if (resolution === 'P4K') return '4K';
  return '1080p';
}

export async function generateScene(input: GenerateSceneInput): Promise<GeneratedScene> {
  const composeModel = await getChatModel('scene-compose', { projectId: input.projectId, project: input.modelConfig });
  const composed = await sceneComposePrompt.pipe(composeModel).invoke({
    sceneBlocks: formatScenePrompt(input.scene),
    shotTimings: shotWindows(input.scene.shots)
      .map((window) => `Shot ${window.position}: ${window.startSeconds}-${window.endSeconds}s`)
      .join('\n'),
    durationSeconds: input.scene.durationSeconds,
    characterBible: input.characterBibleText,
    assetRoster: input.assetRosterText,
    styleConfig: input.styleConfigText,
    aspectRatio: input.aspectRatio,
    researchContext: input.researchContext,
    revisionNote: input.revisionNote,
  });
  const composedText = typeof composed.content === 'string' ? composed.content : JSON.stringify(composed.content);

  const { rewritten, refs, unknown } = await assetResolver.resolve(input.projectId, composedText);
  // Now that the roster is in the prompt the model can also get a handle *wrong* — an unresolved
  // mention stays in the text as a literal "@name" the video model will try to draw. Non-blocking,
  // but it must not vanish silently.
  if (unknown.length > 0) {
    console.warn(`[scenes] scene ${input.scene.index}: unknown asset handles left in prompt: ${unknown.map((h) => `@${h}`).join(', ')}`);
  }
  const referenceImages: AssetRef[] = refs.filter((ref) => ref.type !== 'VOICE');
  const capability = referenceImages.length > 0 ? 'image-to-video' : 'text-to-video';

  const result = await providerRegistry.run(
    capability,
    {
      capability,
      prompt: rewritten,
      referenceImages,
      durationSeconds: input.scene.durationSeconds,
      aspectRatio: aspectRatioFor(input.aspectRatio),
      resolution: resolutionFor(input.resolution),
    },
    {
      project: input.modelConfig,
      resolveApiKey: (provider, apiKeyId) =>
        apiKeyService.getDecrypted(input.projectId, provider, apiKeyId).then((key) => key ?? ''),
    },
  );

  const output = result.outputs[0];
  if (!output) throw new Error(`Scene ${input.scene.index}: provider returned no output`);

  return {
    index: input.scene.index,
    videoUrl: output.url,
    prompt: rewritten,
    costEstimate: result.costEstimate ?? 0,
    providerMeta: result.providerMeta,
  };
}

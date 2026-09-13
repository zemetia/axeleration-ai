import type { ForecastInput } from '@/lib/cost-forecast';
import { prisma } from '@/lib/prisma';
import type { ReadinessInput } from '@/lib/provider-readiness';
import type { ProjectModelConfig } from '@/providers/types';
import { apiKeyService, episodeService } from '@/services';

/**
 * Gathers everything the cost forecast and the readiness check need about one episode.
 *
 * Both answers depend on the same four things — the project's `modelConfig`, the research mode, the
 * current scene breakdown, and the dialogue in it — and both are consumed in two places now: the
 * `/api/episodes/[id]/forecast` route the UI polls, and auto-pilot's budget check. Auto-pilot
 * deciding to spend against a *different* number than the one quoted in the dialog would be the
 * worst kind of bug here, so there is exactly one gatherer.
 *
 * Server-only: reads the database and decrypted-key metadata.
 */

export interface EpisodeForecastContext {
  forecast: ForecastInput;
  readiness: ReadinessInput;
  /** Beats with no clip yet — what "Generate remaining scenes" would actually pay for. */
  remaining: { index: number; durationSeconds: number }[];
  scenes: { index: number; durationSeconds: number }[];
}

/** Returns `null` when the episode does not exist or is not owned by `userId`. */
export async function buildForecastContext(
  episodeId: string,
  userId: string,
): Promise<EpisodeForecastContext | null> {
  const episode = await prisma.episode.findFirst({
    where: { id: episodeId, project: { ownerId: userId } },
    select: {
      researchMode: true,
      project: {
        select: { premise: true, visualStyle: true, tone: true, tags: true, modelConfig: true },
      },
    },
  });
  if (!episode) return null;

  const [script, research, idea, sceneRows, credentials] = await Promise.all([
    episodeService.script(episodeId),
    episodeService.research(episodeId),
    episodeService.idea(episodeId),
    prisma.scene.findMany({
      where: { episodeId, status: 'READY' },
      select: { index: true, videoUrl: true },
    }),
    apiKeyService.credentialedProviders(userId),
  ]);

  const scenes = script?.scenes ?? [];
  const generated = new Set(sceneRows.flatMap((row) => (row.videoUrl ? [row.index] : [])));
  const remaining = scenes.filter((scene) => !generated.has(scene.index));

  const forecast: ForecastInput = {
    modelConfig: (episode.project.modelConfig as ProjectModelConfig | null) ?? undefined,
    researchMode: episode.researchMode,
    sceneCount: scenes.length,
    totalSceneSeconds: scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    dialogueChars: scenes.reduce(
      (sum, scene) =>
        sum + (scene.dialogue ?? []).reduce((chars, entry) => chars + entry.line.length, 0),
      0,
    ),
    briefChars:
      episode.project.premise.length +
      (episode.project.visualStyle?.length ?? 0) +
      (episode.project.tone?.length ?? 0) +
      episode.project.tags.join(' ').length +
      research.summary.length +
      (idea?.length ?? 0),
  };

  return {
    forecast,
    readiness: {
      modelConfig: forecast.modelConfig,
      researchMode: forecast.researchMode,
      sceneCount: forecast.sceneCount,
      dialogueChars: forecast.dialogueChars,
      availableProviders: credentials.saved,
      platformProviders: credentials.platform,
    },
    scenes: scenes.map((scene) => ({ index: scene.index, durationSeconds: scene.durationSeconds })),
    remaining: remaining.map((scene) => ({
      index: scene.index,
      durationSeconds: scene.durationSeconds,
    })),
  };
}

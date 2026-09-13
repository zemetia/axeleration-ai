import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/**
 * Lifecycle for individual `Scene` rows — mirrors `stage-io.ts`'s `withStage`, but scoped to one
 * scene index instead of a whole `EpisodeStage`. Scene rows aren't pre-seeded (unlike the six/seven
 * `EpisodeStage` rows created with the episode) — the first SCENES run creates them lazily, and a
 * targeted regenerate reuses the same row keyed by `(episodeId, index)`.
 */

export async function startScene(episodeId: string, index: number): Promise<{ attempt: number }> {
  const existing = await prisma.scene.findUnique({ where: { episodeId_index: { episodeId, index } } });
  const isRegenerate = existing ? existing.status !== 'PENDING' : false;
  const row = await prisma.scene.upsert({
    where: { episodeId_index: { episodeId, index } },
    create: { episodeId, index, status: 'GENERATING', startedAt: new Date() },
    update: {
      status: 'GENERATING',
      startedAt: new Date(),
      finishedAt: null,
      error: null,
      attempt: isRegenerate ? { increment: 1 } : undefined,
    },
  });
  return { attempt: row.attempt };
}

export interface CompleteSceneInput {
  prompt: string;
  videoUrl: string;
  costEstimate?: number;
  providerMeta?: Prisma.InputJsonValue;
}

export async function completeScene(episodeId: string, index: number, input: CompleteSceneInput): Promise<void> {
  await prisma.scene.update({
    where: { episodeId_index: { episodeId, index } },
    data: {
      status: 'READY',
      finishedAt: new Date(),
      prompt: input.prompt,
      videoUrl: input.videoUrl,
      costEstimate: input.costEstimate,
      providerMeta: input.providerMeta,
    },
  });
}

export async function failScene(episodeId: string, index: number, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.scene.update({
    where: { episodeId_index: { episodeId, index } },
    data: { status: 'FAILED', finishedAt: new Date(), error: message },
  });
}

/** Wraps one scene's generation with the standard GENERATING → READY/FAILED lifecycle + attempt bump. */
export async function withSceneRow<T>(
  episodeId: string,
  index: number,
  run: (ctx: { attempt: number }) => Promise<{ result: T; prompt: string; videoUrl: string; costEstimate?: number; providerMeta?: Prisma.InputJsonValue }>,
): Promise<T> {
  const { attempt } = await startScene(episodeId, index);
  try {
    const { result, prompt, videoUrl, costEstimate, providerMeta } = await run({ attempt });
    await completeScene(episodeId, index, { prompt, videoUrl, costEstimate, providerMeta });
    return result;
  } catch (err) {
    await failScene(episodeId, index, err);
    throw err;
  }
}

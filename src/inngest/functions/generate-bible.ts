import { NonRetriableError } from 'inngest';

import { runBibleChain } from '@/ai/bible/bible-chain';
import { buildProjectBrief } from '@/ai/prompts/project-brief';
import { prisma } from '@/lib/prisma';
import type { ProjectModelConfig } from '@/providers/types';
import type { Prisma } from '@prisma/client';

import { inngest } from '../client';
import { bibleGenerate } from '../events';

/**
 * Fulfills the `generating` CharacterBible row that project creation writes. Until this runs, the
 * Project Detail page shows "Generating…" — this is the function that ends that state.
 */
export const generateBible = inngest.createFunction(
  {
    id: 'generate-bible',
    triggers: [{ event: bibleGenerate }],
    concurrency: { key: 'event.data.projectId', limit: 1 },
  },
  async ({ event, step }) => {
    const { projectId } = event.data;

    const project = await step.run('load-project', async () => {
      const row = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          type: true,
          premise: true,
          tags: true,
          targetAudience: true,
          tone: true,
          visualStyle: true,
          language: true,
          modelConfig: true,
          characterBible: { select: { seedImageUrl: true } },
        },
      });
      if (!row) throw new NonRetriableError(`Project ${projectId} not found`);

      await prisma.characterBible.upsert({
        where: { projectId },
        create: { projectId, lockedTraits: {}, status: 'generating' },
        update: { status: 'generating' },
      });

      return {
        type: row.type as string,
        premise: row.premise,
        brief: buildProjectBrief(row),
        modelConfig: row.modelConfig as ProjectModelConfig | null,
        seedImageUrl: row.characterBible?.seedImageUrl ?? null,
      };
    });

    await step.run('run-identity-lock', async () => {
      try {
        const lockedTraits = await runBibleChain({
          projectId,
          projectType: project.type,
          premise: project.premise,
          brief: project.brief,
          seedImageUrl: project.seedImageUrl,
          modelConfig: project.modelConfig ?? undefined,
        });

        await prisma.characterBible.update({
          where: { projectId },
          data: { lockedTraits: lockedTraits as unknown as Prisma.InputJsonValue, status: 'ready' },
        });
        return null;
      } catch (err) {
        await prisma.characterBible.update({ where: { projectId }, data: { status: 'failed' } });
        throw new NonRetriableError(
          `Character bible generation failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    return { projectId, status: 'ready' };
  },
);

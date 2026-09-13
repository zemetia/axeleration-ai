import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { aiConfig } from '@/config/ai';
import { guardOwner } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { researchDossierPatchSchema } from '@/lib/validations/episode';
import { episodeService } from '@/services';
import type { StageWriteFailure } from '@/services/episode.service';

type Params = { params: Promise<{ id: string }> };

const WRITE_FAILURES: Record<StageWriteFailure, string> = {
  'not-found': 'That stage does not exist on this episode',
  generating: 'This stage is generating right now — wait for it to finish, then edit',
  limit: `An episode can hold at most ${aiConfig.limits.maxScenesPerEpisode} scenes`,
};

/*
 * `@/inngest/*` is loaded lazily for the same reason `episodes/actions.ts` does it: this module is
 * reachable from client hooks' import graph indirectly through nothing here, but keeping the pattern
 * consistent avoids dragging the Inngest SDK into any bundle that imports route types.
 */
async function inngestModules() {
  const [client, events] = await Promise.all([import('@/inngest/client'), import('@/inngest/events')]);
  return { inngest: client.inngest, ...events };
}

/**
 * The RESEARCH stage's own endpoint — separate from every other stage's Server Actions on purpose.
 * `runAdditionalResearchAction` used to live in `episodes/actions.ts` and, like every Server Action,
 * posted to whatever page rendered its button (the Idea room), which read as Research and Idea being
 * the same request even though they are unrelated stages/DB rows/Inngest events. This route makes the
 * dependency explicit: the "Research more" bar always calls `POST /api/episodes/[id]/research`,
 * regardless of which room it is rendered in.
 *
 * Business-rule failures (empty query, regenerate cap hit) come back as 200 + `{ message }`, matching
 * the old `ActionResult` contract the panel already reads inline — only auth/ownership failures are
 * real HTTP errors.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const guard = await guardOwner(() => episodeService.ownerOf(id));
  if (guard instanceof NextResponse) return guard;

  const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return NextResponse.json({ message: 'Enter what you want to research' });
  }

  const row = await prisma.episodeStage.findUnique({
    where: { episodeId_kind: { episodeId: id, kind: 'RESEARCH' } },
  });
  if (row && row.attempt >= aiConfig.limits.maxRegenPerStage) {
    return NextResponse.json({ message: 'Regenerate limit reached for research' });
  }

  const { inngest, researchAdditional } = await inngestModules();
  await inngest.send(researchAdditional.create({ episodeId: id, query }));

  return NextResponse.json({});
}

/** Edits the RESEARCH stage's summary and findings by hand — no generation, no cost. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const guard = await guardOwner(() => episodeService.ownerOf(id));
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const parsed = researchDossierPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'Invalid research edit' });
  }

  const written = await episodeService.updateResearchDossier(id, parsed.data);
  if (!written.ok) {
    return NextResponse.json({ message: WRITE_FAILURES[written.reason] });
  }

  const episode = await prisma.episode.findUnique({ where: { id }, select: { projectId: true } });
  let message: string | undefined;
  if (episode) {
    try {
      const { alignCheckpointAfterManualWrite } = await import('@/ai/graph/manual-authoring');
      await alignCheckpointAfterManualWrite(id, episode.projectId, 'RESEARCH');
    } catch (err) {
      console.error(`[manual] checkpoint alignment failed for ${id}/RESEARCH:`, err);
      message = 'Saved — but the pipeline could not be advanced, so approving may regenerate this stage.';
    }
  }

  return NextResponse.json({ message });
}

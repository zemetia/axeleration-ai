import { HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { StatusChip } from '@/components/shared/StatusChip';
import { PageHeader } from '@/components/ui/PageHeader';
import { requireAuth } from '@/lib/auth';
import { dehydrateQueries } from '@/lib/query-client';
import { episodeService } from '@/services';

import { AutoPilotPanel } from './_components/AutoPilotPanel';
import { ControlRail } from './_components/ControlRail';
import { ReadinessBanner } from './_components/ReadinessBanner';
import { RunningBanner } from './_components/RunningBanner';
import { currencyFormat } from './_components/rooms';

type Props = {
  params: Promise<{ id: string; epId: string }>;
  children: React.ReactNode;
};

/**
 * The control room shell. The pipeline underneath is linear, but the rooms are peers: the rail is
 * always visible and always clickable, so going back to the idea after a render is one click, not a
 * restart.
 */
export default async function EpisodeControlRoomLayout({ params, children }: Props) {
  const { id, epId } = await params;
  const session = await requireAuth();

  const episode = await episodeService.getForOwner(epId, session.user.id);
  if (!episode || episode.projectId !== id) {
    notFound();
  }

  // Every room below (`ControlRail`, `StagePanel`, `ScriptPanel`, `ResearchPanel`) reads
  // `useEpisodeStages`. Without this the whole subtree rendered empty, hydrated, then waited
  // on a client round trip before showing anything — and the stages were already in hand here,
  // included with the episode row above. Seed the cache instead of re-fetching it.
  return (
    <HydrationBoundary
      state={dehydrateQueries([
        [['episode-stages', epId], episode.stages],
        // `AutoPilotPanel` reads the episode row for its budget and stop reason — already in hand
        // here, so seeding it keeps the panel out of a fetch-after-hydrate round trip.
        [['episode', epId], episode],
      ])}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Breadcrumbs
            items={[
              { label: 'Projects', href: '/dashboard' },
              { label: 'Project', href: `/projects/${id}` },
              { label: `Episode ${episode.number}` },
            ]}
          />

          <PageHeader
            eyebrow={`Episode ${String(episode.number).padStart(2, '0')}`}
            title={episode.title || `Episode ${episode.number}`}
            meta={
              <>
                <StatusChip status={episode.status} />
                {episode.totalCost === null ? null : (
                  <span className="text-foreground-muted text-xs tabular-nums">
                    {currencyFormat.format(episode.totalCost)} spent
                  </span>
                )}
              </>
            }
          />
        </div>

        <ReadinessBanner projectId={id} episodeId={epId} />

        <AutoPilotPanel episodeId={epId} />

        <RunningBanner projectId={id} episodeId={epId} />

        <ControlRail projectId={id} episodeId={epId} />

        {children}
      </div>
    </HydrationBoundary>
  );
}

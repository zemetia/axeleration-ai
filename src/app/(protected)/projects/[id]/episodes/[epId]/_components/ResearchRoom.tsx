'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/Button';

import { ResearchPanel } from './ResearchPanel';

export interface ResearchRoomProps {
  projectId: string;
  episodeId: string;
}

/**
 * Room 1 — the dossier the episode is written from, on its own page.
 *
 * It used to be the first panel of the Idea room, which made research something you scrolled past
 * on the way to the script rather than a place you work: the summary, the findings grid and the
 * on-demand agent are a full board on their own, and every one of them is editable. Splitting it
 * out also means the two things happen at different times — an episode is researched once and
 * rewritten many times — and the rail now says so.
 *
 * Not gated on anything, and nothing is gated on it: `ResearchMode.SKIP` is a real choice, so an
 * episode can go straight to the idea.
 */
export function ResearchRoom({ projectId, episodeId }: ResearchRoomProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-foreground-muted max-w-2xl text-sm leading-relaxed">
          What the episode should be grounded in. Run the agent, or write the summary and findings
          yourself — both count the same, and the idea is written from whatever is here. Skipping
          this room entirely is fine; the idea then comes from the premise alone.
        </p>
        <Link
          href={`/projects/${projectId}/episodes/${episodeId}/idea`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          Go to the idea
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <ResearchPanel episodeId={episodeId} />
    </div>
  );
}
ResearchRoom.displayName = 'ResearchRoom';

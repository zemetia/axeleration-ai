'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/Button';

import { IdeaPanel } from './IdeaPanel';
import { ScriptPanel } from './ScriptPanel';

export interface IdeaRoomProps {
  projectId: string;
  episodeId: string;
}

/**
 * Room 2 — where the episode is decided. Idea and script are one board rather than a fixed
 * a-then-b wizard, and both are writable by hand as well as generatable. Full-width rather than a
 * two-column split: the script panel holds an editable beat list, so it needs the room a read-only
 * summary did not.
 *
 * Research used to sit on top of this page and now has its own (see `ResearchRoom`) — it is written
 * once and consulted, while these two are rewritten over and over.
 */
export function IdeaRoom({ projectId, episodeId }: IdeaRoomProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-foreground-muted max-w-2xl text-sm leading-relaxed">
          The idea becomes a scene breakdown. Generate either stage or write it yourself — both
          count the same. Come back here any time; regenerating a stage re-runs everything after it.
        </p>
        <Link
          href={`/projects/${projectId}/episodes/${episodeId}/research`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft aria-hidden="true" />
          Back to research
        </Link>
      </div>

      <IdeaPanel episodeId={episodeId} />
      <ScriptPanel projectId={projectId} episodeId={episodeId} />
    </div>
  );
}
IdeaRoom.displayName = 'IdeaRoom';

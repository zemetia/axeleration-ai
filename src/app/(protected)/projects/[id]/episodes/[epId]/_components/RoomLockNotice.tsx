'use client';

import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/Button';

import type { RoomId } from './rooms';

export interface RoomLockNoticeProps {
  title: string;
  reason: string;
  projectId: string;
  episodeId: string;
  /** The room that has to produce something first. */
  backRoom: RoomId;
  backLabel: string;
}

/**
 * Shown when a room's upstream stage hasn't produced anything yet. The room still renders and stays
 * linkable — this only explains what's missing and offers the one-click way back.
 */
export function RoomLockNotice({
  title,
  reason,
  projectId,
  episodeId,
  backRoom,
  backLabel,
}: RoomLockNoticeProps) {
  return (
    <div className="border-border bg-surface-raised flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
      <span
        className="bg-surface text-foreground-subtle flex size-11 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <Lock className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-foreground text-base font-semibold">{title}</h3>
        <p className="text-foreground-muted mx-auto max-w-md text-sm leading-relaxed">{reason}</p>
      </div>
      <Link
        href={`/projects/${projectId}/episodes/${episodeId}/${backRoom}` as const}
        className={buttonVariants({ variant: 'outline', size: 'md' })}
      >
        <ArrowLeft aria-hidden="true" />
        {backLabel}
      </Link>
    </div>
  );
}
RoomLockNotice.displayName = 'RoomLockNotice';

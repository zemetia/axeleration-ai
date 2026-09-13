'use client';

import { AlertCircle, Check, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useEpisodeStages } from '@/hooks/queries';

import { buildRoomStates, roomStatusTone, type RoomStatus } from './rooms';

export interface ControlRailProps {
  projectId: string;
  episodeId: string;
}

/**
 * The badge on each room. It carries the state on its own — a check means approved, a spinner
 * means running — so the rail is readable without stopping to parse the sentence underneath.
 */
function RoomBadge({
  status,
  position,
  isActive,
}: {
  status: RoomStatus;
  position: number;
  isActive: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors [&_svg]:size-3.5',
        status === 'done'
          ? 'bg-success text-success-foreground'
          : status === 'failed'
            ? 'bg-destructive text-destructive-foreground'
            : status === 'working'
              ? 'bg-primary text-primary-foreground'
              : status === 'review'
                ? 'bg-warning text-warning-foreground'
                : isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-raised text-foreground-subtle',
      )}
    >
      {status === 'done' ? (
        <Check />
      ) : status === 'failed' ? (
        <AlertCircle />
      ) : status === 'working' ? (
        <Loader2 className="animate-spin" />
      ) : status === 'locked' ? (
        <Lock />
      ) : (
        position
      )}
    </span>
  );
}

/** The control room's switchboard: every room is always reachable, whatever the pipeline is doing. */
export function ControlRail({ projectId, episodeId }: ControlRailProps) {
  const { data: stages } = useEpisodeStages(episodeId);
  const pathname = usePathname();
  const rooms = buildRoomStates(stages);

  return (
    <nav aria-label="Episode rooms" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rooms.map((room, index) => {
        // Built from the params rather than a prebuilt string so `typedRoutes` can match the literal.
        const href = `/projects/${projectId}/episodes/${episodeId}/${room.id}` as const;
        const isActive = pathname === href;

        return (
          <Link
            key={room.id}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group flex flex-col gap-2 rounded-2xl border p-4 transition-[transform,box-shadow,border-color] duration-200',
              isActive
                ? 'elevation-sm border-primary/40 bg-surface ring-primary/10 ring-4'
                : 'border-border bg-surface hover:border-border-strong hover:elevation-sm hover:-translate-y-0.5',
              room.status === 'locked' && !isActive && 'bg-surface-raised',
            )}
          >
            <div className="flex items-center gap-2.5">
              <RoomBadge status={room.status} position={index + 1} isActive={isActive} />
              <span
                className={cn(
                  'text-sm font-semibold',
                  room.status === 'locked' && !isActive
                    ? 'text-foreground-muted'
                    : 'text-foreground',
                )}
              >
                {room.label}
              </span>
            </div>

            {/* Indented to the badge's text column so the three cards line up as one rail. */}
            <div className="flex flex-col gap-1 pl-[2.375rem]">
              <span className={cn('text-xs font-medium', roomStatusTone(room.status))}>
                {room.detail}
              </span>
              <span className="text-foreground-subtle text-xs leading-relaxed">{room.blurb}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
ControlRail.displayName = 'ControlRail';

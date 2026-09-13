'use client';

import { CircleStop } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  useCancelEpisodeRun,
  useEpisodeForecast,
  useEpisodeStages,
  useScenes,
  useStageActivity,
} from '@/hooks/queries';

import { RunStatus } from './RunStatus';
import { ROOMS, STAGE_LABELS, STAGE_RUNNING_LABELS } from './rooms';

export interface RunningBannerProps {
  projectId: string;
  episodeId: string;
}

/**
 * One strip under the episode header saying what the pipeline is doing right now, whichever room
 * the user is standing in. Generation takes minutes and the rooms are peers, so it was possible to
 * navigate away from a running stage and lose every trace of it — the destination room just showed
 * an empty panel. This makes the run follow the user, and links back to the room that owns it.
 */
export function RunningBanner({ projectId, episodeId }: RunningBannerProps) {
  const { data: stages } = useEpisodeStages(episodeId);
  const { data: forecast } = useEpisodeForecast(episodeId);
  const activity = useStageActivity(episodeId);
  const cancelRun = useCancelEpisodeRun(episodeId);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const running = stages?.find((stage) => stage.status === 'GENERATING');
  // Fetched only for the batch denominator, and only while the batch is actually running — this
  // banner sits in the layout, so an unconditional query would cost every room a scenes request.
  const { data: scenes } = useScenes(episodeId, { enabled: running?.kind === 'SCENES' });

  if (!running) return null;

  const room = ROOMS.find((entry) => entry.stages.includes(running.kind));
  const total = scenes?.length ?? 0;
  const progress =
    running.kind === 'SCENES' && total > 0
      ? { done: scenes?.filter((scene) => scene.videoUrl).length ?? 0, total }
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <RunStatus
        label={STAGE_RUNNING_LABELS[running.kind]}
        activity={activity[running.kind]}
        startedAt={running.startedAt}
        etaSeconds={forecast?.stages[running.kind]?.etaSeconds}
        progress={progress}
      />
      <div className="flex flex-wrap items-center gap-3">
        {room ? (
          <Link
            href={`/projects/${projectId}/episodes/${episodeId}/${room.id}`}
            className="text-foreground-muted hover:text-foreground text-xs underline underline-offset-2"
          >
            Watch it in {room.label}
          </Link>
        ) : null}
        {/* Until now a run could not be stopped from anywhere in the app: once a batch started you
            watched it spend. This sits in the banner rather than a room, because the banner is the
            thing that follows the user — wherever they notice the mistake, Stop is there. */}
        <Button
          variant="outline"
          size="sm"
          isLoading={cancelRun.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {cancelRun.isPending ? null : <CircleStop aria-hidden="true" />}
          Stop this run
        </Button>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop {STAGE_LABELS[running.kind].toLowerCase()}?</DialogTitle>
            <DialogDescription>
              Stops this run and turns auto-pilot off, so nothing else starts. Work already sent to
              a provider is already paid for and may still land — anything it does not finish is
              marked failed, and you can regenerate it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={cancelRun.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              Keep going
            </Button>
            <Button
              variant="destructive"
              isLoading={cancelRun.isPending}
              onClick={() =>
                cancelRun.mutate(undefined, { onSettled: () => setConfirmOpen(false) })
              }
            >
              {cancelRun.isPending ? 'Stopping…' : 'Stop the run'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
RunningBanner.displayName = 'RunningBanner';

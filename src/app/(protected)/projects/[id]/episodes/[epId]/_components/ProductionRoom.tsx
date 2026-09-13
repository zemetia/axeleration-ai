'use client';

import { Download } from 'lucide-react';

import { Skeleton } from '@/components/ui/Skeleton';
import { useEpisodeStages } from '@/hooks/queries';
import type { EpisodeStageVO } from '@/types/value-objects';

import { RoomLockNotice } from './RoomLockNotice';
import { StagePanel } from './StagePanel';
import { hasOutput } from './rooms';

export interface ProductionRoomProps {
  projectId: string;
  episodeId: string;
}

/** Room 3 — voice, music and the final cut side by side; they all consume the same finished scenes. */
export function ProductionRoom({ projectId, episodeId }: ProductionRoomProps) {
  const { data: stages, isLoading } = useEpisodeStages(episodeId);

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  const scenes = stages?.find((stage) => stage.kind === 'SCENES');
  if (!hasOutput(scenes)) {
    return (
      <RoomLockNotice
        title="No scenes to produce yet"
        reason="Voice, music and the final render all build on generated scenes — produce those first, then come back."
        projectId={projectId}
        episodeId={episodeId}
        backRoom="scenes"
        backLabel="Go to Scenes"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-foreground-muted max-w-2xl text-sm leading-relaxed">
        Voice and music are layered over the scenes; the render stitches everything into the final
        cut. Each can be redone on its own without rebuilding the scenes.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <StagePanel episodeId={episodeId} kind="VOICE" />
        <StagePanel episodeId={episodeId} kind="MUSIC" />
      </div>

      <StagePanel episodeId={episodeId} kind="RENDER">
        {(stage: EpisodeStageVO) => {
          const url = typeof stage.output?.['url'] === 'string' ? stage.output['url'] : null;
          if (!url) return <p className="text-foreground-subtle text-sm">No final cut yet.</p>;
          return (
            <div className="flex flex-col gap-3">
              <video
                controls
                src={url}
                className="border-border bg-foreground/5 w-full rounded-xl border"
              />
              <a
                href={url}
                download
                className="text-primary-text inline-flex w-fit items-center gap-1.5 text-xs font-medium hover:underline"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Download final cut
              </a>
            </div>
          );
        }}
      </StagePanel>
    </div>
  );
}
ProductionRoom.displayName = 'ProductionRoom';

'use client';

import { AlertCircle, Check, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { StatusChip } from '@/components/shared/StatusChip';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { aiConfig } from '@/config/ai';
import {
  useApproveStage,
  useEpisodeForecast,
  useEpisodeStages,
  useRegenerateStage,
  useScenes,
} from '@/hooks/queries';

import { RoomLockNotice } from './RoomLockNotice';
import { RunDialog } from './RunDialog';
import { RunStatus } from './RunStatus';
import { SceneCard } from './SceneCard';
import { currencyFormat, hasOutput } from './rooms';

export interface ScenesRoomProps {
  projectId: string;
  episodeId: string;
}

/**
 * Room 2 — one card per beat of the script. Cards exist as soon as the script does, so a beat can be
 * rewritten before a single frame is generated, and any one scene can be redone without touching the rest.
 */
export function ScenesRoom({ projectId, episodeId }: ScenesRoomProps) {
  const { data: stages, isLoading: isLoadingStages } = useEpisodeStages(episodeId);
  const scenesStageStatus = stages?.find((stage) => stage.kind === 'SCENES')?.status;
  const { data: scenes, isLoading: isLoadingScenes } = useScenes(episodeId, {
    isRunning: scenesStageStatus === 'GENERATING',
  });
  const { data: forecast } = useEpisodeForecast(episodeId);
  const approveStage = useApproveStage(episodeId);
  const regenerateStage = useRegenerateStage(episodeId);
  const [openDialog, setOpenDialog] = useState<'start' | 'regenerate' | 'approve' | null>(null);

  const script = stages?.find((stage) => stage.kind === 'SCRIPT');
  const scenesStage = stages?.find((stage) => stage.kind === 'SCENES');

  if (isLoadingStages || isLoadingScenes) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (!hasOutput(script)) {
    return (
      <RoomLockNotice
        title="No script yet"
        reason="Scenes open up as soon as the script exists — each beat becomes a card you can rewrite and generate on its own."
        projectId={projectId}
        episodeId={episodeId}
        backRoom="idea"
        backLabel="Go to Idea & Script"
      />
    );
  }

  const isBatchRunning = scenesStage?.status === 'GENERATING';
  const attemptsLeft = aiConfig.limits.maxRegenPerStage - (scenesStage?.attempt ?? 0);
  const isRegenLimitReached = attemptsLeft <= 0;
  const total = scenes?.length ?? 0;
  const generatedCount = (scenes ?? []).filter((scene) => scene.videoUrl).length;
  const remainingCount = total - generatedCount;
  const batchForecast = forecast?.stages['SCENES'];
  const voiceForecast = forecast?.stages['VOICE'];
  // Priced over only the beats still missing a clip — a batch reuses the rest (see `scenesNode`).
  const remainingForecast = forecast?.scenesRemaining;

  /*
   * The batch and the per-card Generate are the same operation at two grains, so the batch button
   * has to describe whatever is actually left rather than assume it starts from zero: a user who
   * generated three of eight cards by hand needs "generate the other five", not a choice between
   * nothing and paying for all eight again.
   *
   * Which action delivers that depends only on whether SCRIPT is still awaiting approval. While it
   * is READY, Approve is the way in — resuming the thread runs `scenesNode`, which defaults to the
   * `'missing'` scope and skips what already exists. Once SCRIPT is APPROVED that door is shut
   * (`resume-stage` no-ops on a stage that isn't READY), so the same fill-the-gaps run has to be
   * asked for directly as a scoped regenerate.
   */
  const isScriptAwaitingApproval = script?.status === 'READY';
  const canFillGaps =
    remainingCount > 0 && !isBatchRunning && (isScriptAwaitingApproval || !isRegenLimitReached);
  const fillLabel =
    generatedCount === 0 ? 'Generate all scenes' : `Generate ${remainingCount} remaining`;
  const isFillPending = isScriptAwaitingApproval
    ? approveStage.isPending
    : regenerateStage.isPending;

  function startFillRun() {
    if (isScriptAwaitingApproval) {
      approveStage.mutate('SCRIPT', { onSettled: () => setOpenDialog(null) });
      return;
    }
    regenerateStage.mutate(
      { stage: 'SCENES', scope: 'missing' },
      { onSettled: () => setOpenDialog(null) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="elevation-sm border-border bg-surface flex flex-col gap-4 rounded-2xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-foreground text-sm font-semibold tracking-tight">Scene batch</h3>
              {scenesStage ? <StatusChip status={scenesStage.status} /> : null}
              {typeof scenesStage?.costEstimate === 'number' ? (
                <span className="text-foreground-muted text-xs tabular-nums">
                  {currencyFormat.format(scenesStage.costEstimate)} spent
                </span>
              ) : null}
            </div>
            <p className="text-foreground-muted max-w-xl text-sm leading-relaxed">
              Generate every beat at once here, or one at a time from a card — a batch keeps the
              clips that already exist and only pays for the ones that don&apos;t.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canFillGaps ? (
              <Button size="sm" isLoading={isFillPending} onClick={() => setOpenDialog('start')}>
                {isFillPending ? null : <Sparkles aria-hidden="true" />}
                {isFillPending ? 'Starting…' : fillLabel}
              </Button>
            ) : null}
            {generatedCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isBatchRunning || regenerateStage.isPending || isRegenLimitReached}
                onClick={() => setOpenDialog('regenerate')}
              >
                <RotateCcw aria-hidden="true" />
                {isBatchRunning || regenerateStage.isPending ? 'Generating…' : 'Regenerate all'}
              </Button>
            ) : null}
            {scenesStage?.status === 'READY' ? (
              <Button
                size="sm"
                isLoading={approveStage.isPending}
                disabled={approveStage.isPending || remainingCount > 0}
                onClick={() => setOpenDialog('approve')}
              >
                {approveStage.isPending ? null : <Check aria-hidden="true" />}
                {approveStage.isPending ? 'Approving…' : 'Approve scenes'}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Counted clips, not elapsed time — this is the one stage with a real denominator. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-foreground-muted font-medium">
              {generatedCount} of {total} scenes generated
            </span>
            {remainingCount > 0 ? (
              <span className="text-foreground-subtle">{remainingCount} left</span>
            ) : (
              <span className="text-success font-medium">All clips in</span>
            )}
          </div>
          <Progress
            value={total > 0 ? Math.round((generatedCount / total) * 100) : 0}
            aria-label="Scenes generated"
            indicatorClassName={remainingCount === 0 ? 'bg-success' : undefined}
          />
        </div>

        {/*
          Approving hands the whole scene list to the voice pass, so a beat with no clip would be
          carried into the cut as a hole. Say why the button is dead rather than just dimming it.
        */}
        {scenesStage?.status === 'READY' && remainingCount > 0 ? (
          <p className="bg-warning-subtle text-warning-text flex items-start gap-2 rounded-lg px-3 py-2 text-xs">
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {remainingCount} {remainingCount === 1 ? 'scene has' : 'scenes have'} no clip yet —
            generate {remainingCount === 1 ? 'it' : 'them'} before approving.
          </p>
        ) : null}
        {isRegenLimitReached && !isScriptAwaitingApproval ? (
          <p className="text-foreground-subtle text-xs">
            Batch limit reached — generate scenes one card at a time.
          </p>
        ) : null}

        {/*
          The batch is the one place with a real denominator, so its progress is counted clips rather
          than elapsed-against-forecast. `startedAt` comes from the stage row, the count from the
          `Scene` rows the nodes write as each clip lands.
        */}
        {isBatchRunning ? (
          <RunStatus
            label="Generating scene clips"
            startedAt={scenesStage?.startedAt ?? null}
            etaSeconds={batchForecast?.etaSeconds}
            progress={{ done: generatedCount, total }}
          />
        ) : null}
      </div>

      {scenesStage?.status === 'FAILED' ? (
        <div className="border-destructive/20 bg-destructive-subtle flex items-start gap-2.5 rounded-xl border p-4">
          <AlertCircle
            className="text-destructive-text mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <p className="text-destructive-text text-sm leading-relaxed">
            {scenesStage.error ?? 'Scene generation failed.'}
          </p>
        </div>
      ) : null}

      {scenes && scenes.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.index}
              projectId={projectId}
              episodeId={episodeId}
              scene={scene}
            />
          ))}
        </div>
      ) : (
        <p className="border-border bg-surface-raised text-foreground-muted rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
          The script produced no scenes — regenerate it from the Idea room.
        </p>
      )}

      <RunDialog
        isOpen={openDialog === 'start'}
        onOpenChange={(open) => setOpenDialog(open ? 'start' : null)}
        title={
          generatedCount === 0
            ? `Generate all ${total} scenes?`
            : `Generate the ${remainingCount} remaining ${remainingCount === 1 ? 'scene' : 'scenes'}?`
        }
        description={[
          generatedCount === 0
            ? 'Generates every beat in one batch. This is the most expensive step in the pipeline — you can also generate scenes one card at a time instead.'
            : `Generates only the ${remainingCount} ${remainingCount === 1 ? 'beat' : 'beats'} with no clip yet. The ${generatedCount} you already have are kept and not paid for again.`,
          isScriptAwaitingApproval ? 'This also approves the script.' : null,
        ]
          .filter(Boolean)
          .join(' ')}
        {...(remainingForecast ? { forecast: remainingForecast } : {})}
        confirmLabel={isScriptAwaitingApproval ? 'Approve script & generate' : 'Generate scenes'}
        pendingLabel="Starting…"
        isPending={isFillPending}
        onConfirm={startFillRun}
      />

      <RunDialog
        isOpen={openDialog === 'regenerate'}
        onOpenChange={(open) => setOpenDialog(open ? 'regenerate' : null)}
        title="Regenerate every scene?"
        description={`Throws away all ${generatedCount} generated clips and pays for the whole batch again. To redo just one, use its card. ${attemptsLeft} of ${aiConfig.limits.maxRegenPerStage} batch runs left.`}
        {...(batchForecast ? { forecast: batchForecast } : {})}
        confirmLabel="Regenerate all scenes"
        pendingLabel="Starting…"
        isPending={regenerateStage.isPending}
        isDanger
        onConfirm={() =>
          regenerateStage.mutate(
            { stage: 'SCENES', scope: 'all' },
            { onSettled: () => setOpenDialog(null) },
          )
        }
      />

      <RunDialog
        isOpen={openDialog === 'approve'}
        onOpenChange={(open) => setOpenDialog(open ? 'approve' : null)}
        title="Approve the scenes?"
        description="Accepts every clip as final and immediately starts the voice pass. That is where the cost below comes from."
        {...(voiceForecast ? { forecast: voiceForecast } : {})}
        confirmLabel="Approve & start voice"
        pendingLabel="Approving…"
        isPending={approveStage.isPending}
        onConfirm={() => approveStage.mutate('SCENES', { onSettled: () => setOpenDialog(null) })}
      />
    </div>
  );
}
ScenesRoom.displayName = 'ScenesRoom';

'use client';

import { AlertCircle, Check, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { StatusChip } from '@/components/shared/StatusChip';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { aiConfig } from '@/config/ai';
import {
  useApproveStage,
  useEpisodeForecast,
  useEpisodeStages,
  useRegenerateStage,
  useStageActivity,
} from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { nextStageAfter } from '@/config/pipeline';
import { blockedReason } from '@/lib/provider-readiness';
import type { EpisodeStageVO } from '@/types/value-objects';
import type { StageKind } from '@prisma/client';

import { RunDialog } from './RunDialog';
import { RunStatus } from './RunStatus';
import { STAGE_LABELS, STAGE_RUNNING_LABELS, currencyFormat } from './rooms';

export interface StagePanelProps {
  episodeId: string;
  kind: StageKind;
  /** Overrides the default output preview — used by rooms that render their own view of a stage. */
  children?: (stage: EpisodeStageVO) => ReactNode;
  /** Extra controls next to Approve / Regenerate. */
  actions?: (stage: EpisodeStageVO) => ReactNode;
  /**
   * Shown while the stage is still PENDING — the "write it yourself" path, offered next to the
   * AI one instead of leaving an empty panel with nothing to click.
   */
  emptyAction?: (stage: EpisodeStageVO) => ReactNode;
  /** Names the stage that has to be approved for the AI to fill this one in. */
  upstreamLabel?: string;
  /**
   * Hides the built-in Regenerate button — for a stage whose room offers a non-destructive way to
   * add to what is there instead (RESEARCH's "Research" bar) rather than the wholesale replace
   * every other stage uses.
   */
  hideRegenerate?: boolean;
  className?: string;
}

function DefaultPreview({ output }: { output: Record<string, unknown> | null }) {
  if (!output) return <p className="text-foreground-subtle text-sm">Nothing generated yet.</p>;

  if (output['skipped'] === true) {
    return (
      <p className="text-foreground-muted text-sm">
        Skipped{typeof output['reason'] === 'string' ? ` — ${output['reason']}` : ''}.
      </p>
    );
  }

  const text = ['idea', 'text', 'brief']
    .map((key) => output[key])
    .find((value) => typeof value === 'string');
  const url = typeof output['url'] === 'string' ? output['url'] : null;

  return (
    <div className="flex flex-col gap-3">
      {typeof text === 'string' && text ? (
        <p className="text-foreground text-sm whitespace-pre-line">{text}</p>
      ) : null}
      {url && /\.(mp4|webm|mov)$/i.test(url) ? (
        <video controls src={url} className="border-border w-full max-w-lg rounded-md border" />
      ) : url ? (
        <audio controls src={url} className="w-full max-w-lg" />
      ) : null}
      {!text && !url ? (
        <pre className="bg-surface-raised text-foreground-muted max-h-48 overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify(output, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

/**
 * One pipeline stage inside a room: status, preview, and the Approve / Regenerate controls.
 * Reads its own stage from the shared `useEpisodeStages` query so rooms on different sub-pages can
 * each drop in the panels they care about without prop-drilling the whole stage list.
 *
 * Both buttons open a `RunDialog` rather than acting on the second click of a relabelled button.
 * Approve is quoted against the *next* stage: accepting SCRIPT is what starts — and pays for —
 * the scene batch, so that is the number the user needs before pressing it.
 */
export function StagePanel({
  episodeId,
  kind,
  children,
  actions,
  emptyAction,
  upstreamLabel,
  hideRegenerate,
  className,
}: StagePanelProps) {
  const { data: stages, isLoading, isError, isFetching, refetch } = useEpisodeStages(episodeId);
  const { data: forecast } = useEpisodeForecast(episodeId);
  const activity = useStageActivity(episodeId);
  const approveStage = useApproveStage(episodeId);
  const regenerateStage = useRegenerateStage(episodeId);
  const [note, setNote] = useState('');
  const [openDialog, setOpenDialog] = useState<'approve' | 'regenerate' | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const stage = stages?.find((row) => row.kind === kind);

  if (!stage) {
    // Only a *first* load is a skeleton. A failed fetch used to land here too — `isLoading` is
    // false once the query has errored, and `stage` is still undefined — so the panel sat on a
    // shimmer with no message and no way back, which is what a starved or aborted
    // `/api/episodes/[id]/stages` looked like on screen. Say so, and offer the retry.
    if (isLoading) {
      return <Skeleton className={cn('h-32 w-full rounded-2xl', className)} />;
    }

    return (
      <section
        className={cn(
          'elevation-sm border-border bg-surface flex flex-col items-start gap-2.5 rounded-2xl border p-5',
          className,
        )}
      >
        <div className="flex items-center gap-2.5">
          <AlertCircle className="text-destructive-text size-4 shrink-0" aria-hidden="true" />
          <h3 className="text-foreground text-sm font-semibold tracking-tight">
            {STAGE_LABELS[kind]}
          </h3>
        </div>
        <p className="text-foreground-muted text-sm leading-relaxed">
          {isError
            ? 'Could not load this stage.'
            : 'This stage is not on this episode — it may have been built with an older pipeline.'}
        </p>
        <Button size="sm" variant="outline" isLoading={isFetching} onClick={() => void refetch()}>
          {isFetching ? null : <RotateCcw aria-hidden="true" />}
          {isFetching ? 'Retrying…' : 'Retry'}
        </Button>
      </section>
    );
  }

  const isApproving = approveStage.isPending && approveStage.variables === kind;
  const isRegenerating = regenerateStage.isPending && regenerateStage.variables?.stage === kind;
  const attemptsLeft = aiConfig.limits.maxRegenPerStage - stage.attempt;
  const isRegenLimitReached = attemptsLeft <= 0;
  const isActionable =
    stage.status === 'READY' || stage.status === 'FAILED' || stage.status === 'APPROVED';

  const downstream = nextStageAfter(kind);
  const approveForecast = downstream ? forecast?.stages[downstream] : undefined;
  const ownForecast = forecast?.stages[kind];

  // Each button is gated by the stage it *starts*, which is not always this one. Approving hands
  // control to the downstream stage — that is what will resolve a provider and fail — while
  // Regenerate re-runs this stage. Same asymmetry the cost forecast already models.
  const approveBlocked = downstream ? blockedReason(forecast?.readiness.stages[downstream]) : null;
  const regenerateBlocked = blockedReason(forecast?.readiness.stages[kind]);

  return (
    <section
      className={cn(
        'elevation-sm border-border bg-surface overflow-hidden rounded-2xl border',
        // A stage waiting on the user is the one thing on the page that should pull the eye.
        stage.status === 'READY' && 'border-warning/35 ring-warning/8 ring-4',
        stage.status === 'FAILED' && 'border-destructive/35',
        className,
      )}
    >
      <header className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-foreground text-sm font-semibold tracking-tight">
            {STAGE_LABELS[kind]}
          </h3>
          <StatusChip status={stage.status} />
          {stage.attempt > 0 ? (
            <span className="text-foreground-subtle text-xs">attempt {stage.attempt + 1}</span>
          ) : null}
        </div>
        {stage.costEstimate === null ? null : (
          <span className="text-foreground-muted text-xs tabular-nums">
            {currencyFormat.format(stage.costEstimate)} spent
          </span>
        )}
      </header>

      <div className="p-5">
        {stage.status === 'GENERATING' ? (
          <RunStatus
            label={STAGE_RUNNING_LABELS[kind]}
            activity={activity[kind]}
            startedAt={stage.startedAt}
            etaSeconds={ownForecast?.etaSeconds}
          />
        ) : stage.status === 'FAILED' ? (
          <div className="border-destructive/20 bg-destructive-subtle flex items-start gap-2.5 rounded-xl border p-4">
            <AlertCircle
              className="text-destructive-text mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p className="text-destructive-text text-sm leading-relaxed">
              {stage.error ?? 'Generation failed.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {stage.status === 'PENDING' && emptyAction ? (
              <div className="border-border bg-surface-raised flex flex-col items-start gap-2.5 rounded-xl border border-dashed px-4 py-5">
                <p className="text-foreground-muted text-sm">
                  Nothing here yet — write it yourself, or let the AI do it.
                </p>
                {emptyAction(stage)}
                {/* RESEARCH is the first stage — there is nothing upstream whose approval would fill it in. */}
                {upstreamLabel ? (
                  <p className="text-foreground-subtle text-xs">
                    Approving {upstreamLabel} generates this stage instead.
                  </p>
                ) : null}
              </div>
            ) : null}
            {children ? children(stage) : <DefaultPreview output={stage.output} />}
          </div>
        )}
      </div>

      {isActionable ? (
        <footer className="border-border bg-surface-raised flex flex-col gap-2 border-t px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {stage.status === 'READY' ? (
              <Button
                size="sm"
                isLoading={isApproving}
                disabled={isApproving || Boolean(approveBlocked)}
                title={approveBlocked ?? undefined}
                onClick={() => setOpenDialog('approve')}
              >
                {isApproving ? null : <Check aria-hidden="true" />}
                {isApproving ? 'Approving…' : 'Approve'}
              </Button>
            ) : null}
            {!hideRegenerate ? (
              <Button
                size="sm"
                variant="outline"
                isLoading={isRegenerating}
                disabled={isRegenerating || isRegenLimitReached || Boolean(regenerateBlocked)}
                title={regenerateBlocked ?? undefined}
                onClick={() => setOpenDialog('regenerate')}
              >
                {isRegenerating ? null : <RotateCcw aria-hidden="true" />}
                {isRegenerating ? 'Regenerating…' : 'Regenerate'}
              </Button>
            ) : null}
            {actions?.(stage)}
            {!hideRegenerate && isRegenLimitReached ? (
              <span className="text-foreground-subtle text-xs">
                Regenerate limit reached ({aiConfig.limits.maxRegenPerStage} runs) — edit the text
                by hand instead.
              </span>
            ) : null}
          </div>

          {/* The reason has to be on the page, not only in a `title` — a disabled button explains
              nothing to a touch user, and this is the exact message that used to arrive as a
              FAILED row after five attempts. */}
          {approveBlocked && stage.status === 'READY' ? (
            <p className="text-warning-text text-xs">
              Approve is unavailable — {approveBlocked}{' '}
              <Link href="/settings" className="underline underline-offset-2">
                Add a key
              </Link>
            </p>
          ) : null}
          {!hideRegenerate && regenerateBlocked && !isRegenLimitReached ? (
            <p className="text-warning-text text-xs">
              Regenerate is unavailable — {regenerateBlocked}{' '}
              <Link href="/settings" className="underline underline-offset-2">
                Add a key
              </Link>
            </p>
          ) : null}
          {regenerateError ? (
            <p className="text-destructive-text text-xs">{regenerateError}</p>
          ) : null}
          {stage.status === 'APPROVED' ? (
            <p className="text-foreground-subtle text-xs">
              Approved — regenerating this stage re-runs everything downstream of it.
            </p>
          ) : null}
        </footer>
      ) : null}

      <RunDialog
        isOpen={openDialog === 'approve'}
        onOpenChange={(open) => setOpenDialog(open ? 'approve' : null)}
        title={`Approve ${STAGE_LABELS[kind].toLowerCase()}?`}
        description={
          downstream
            ? `Accepts this ${STAGE_LABELS[kind].toLowerCase()} and immediately starts ${STAGE_LABELS[downstream].toLowerCase()}. That is where the cost below comes from.`
            : `Accepts this ${STAGE_LABELS[kind].toLowerCase()}. Nothing else runs — this is the last stage.`
        }
        {...(approveForecast ? { forecast: approveForecast } : {})}
        confirmLabel={
          downstream ? `Approve & start ${STAGE_LABELS[downstream].toLowerCase()}` : 'Approve'
        }
        pendingLabel="Approving…"
        isPending={isApproving}
        onConfirm={() => approveStage.mutate(kind, { onSettled: () => setOpenDialog(null) })}
      />

      {!hideRegenerate ? (
        <RunDialog
          isOpen={openDialog === 'regenerate'}
          onOpenChange={(open) => setOpenDialog(open ? 'regenerate' : null)}
          title={`Regenerate ${STAGE_LABELS[kind].toLowerCase()}?`}
          description={`Replaces the current ${STAGE_LABELS[kind].toLowerCase()} — including anything you wrote by hand — and re-runs every stage after it. ${attemptsLeft} of ${aiConfig.limits.maxRegenPerStage} runs left.`}
          {...(ownForecast ? { forecast: ownForecast } : {})}
          note={{
            value: note,
            onChange: setNote,
            placeholder: 'e.g. "make it darker", "cut the narration"',
          }}
          confirmLabel="Regenerate"
          pendingLabel="Starting…"
          isPending={isRegenerating}
          isDanger
          onConfirm={() => {
            setRegenerateError(null);
            regenerateStage.mutate(
              { stage: kind, note: note || undefined },
              {
                onSuccess: (result) => setRegenerateError(result.message ?? null),
                onSettled: () => {
                  setNote('');
                  setOpenDialog(null);
                },
              },
            );
          }}
        />
      ) : null}
    </section>
  );
}
StagePanel.displayName = 'StagePanel';

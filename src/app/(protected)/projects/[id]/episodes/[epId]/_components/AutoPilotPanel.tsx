'use client';

import { CircleStop, Rocket } from 'lucide-react';
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
import { NumberInputField } from '@/components/ui/NumberInputField';
import {
  useEpisode,
  useEpisodeForecast,
  useEpisodeStages,
  useStartAutoPilot,
  useStopAutoPilot,
} from '@/hooks/queries';
import { formatEta } from '@/lib/cost-forecast';

import { remainingWork } from './autopilot-summary';
import { STAGE_LABELS, currencyTotalFormat } from './rooms';

export interface AutoPilotPanelProps {
  episodeId: string;
}

/**
 * "Make the rest of this episode for me, and stop at $X."
 *
 * The manual path is seven Approve dialogs between a premise and a finished video, each one a
 * decision the user has already made by the time they get there. Auto-pilot collapses them into a
 * single decision that is actually worth making — how much this episode is allowed to cost — and
 * then presses Approve on their behalf until it finishes, hits the cap, or hits a problem.
 *
 * The budget is the whole safety story, so it is stated three times: as the default derived from
 * the real forecast, as the number in the confirm dialog, and as the running total against the cap
 * while it works. Stopping is always available, and the dialog is honest that a stage already
 * generating is already paid for.
 */
export function AutoPilotPanel({ episodeId }: AutoPilotPanelProps) {
  const { data: episode } = useEpisode(episodeId);
  const { data: stages } = useEpisodeStages(episodeId);
  const { data: forecast } = useEpisodeForecast(episodeId);
  const startAutoPilot = useStartAutoPilot(episodeId);
  const stopAutoPilot = useStopAutoPilot(episodeId);

  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [budget, setBudget] = useState<number | null>(null);

  if (!episode || !stages) return null;

  const work = remainingWork(stages, forecast);
  const autoPilot = episode.autoPilot;
  const spent = episode.totalCost ?? 0;

  // A 25% margin over the forecast, which is explicitly order-of-magnitude — a cap set exactly at
  // the estimate would stop the run on the first stage that came in slightly over.
  const suggested = Math.max(0.05, Math.ceil(work.totalUsd * 1.25 * 100) / 100);
  const chosenBudget = budget ?? suggested;

  const blockedReasons = work.blocked;
  const canStart = work.stages.length > 0 && blockedReasons.length === 0;

  return (
    <section className="elevation-sm border-border bg-surface flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="bg-primary-subtle text-primary-text flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4"
            aria-hidden="true"
          >
            <Rocket />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">Auto-pilot</h2>
            <p className="text-foreground-muted text-sm">
              {autoPilot.isRunning
                ? 'Approving each stage for you until the episode is done or the budget runs out.'
                : 'Run every remaining stage without stopping to approve each one.'}
            </p>
          </div>
        </div>

        {autoPilot.isRunning ? (
          <Button
            variant="outline"
            size="sm"
            isLoading={stopAutoPilot.isPending}
            onClick={() => stopAutoPilot.mutate(undefined)}
          >
            {stopAutoPilot.isPending ? null : <CircleStop aria-hidden="true" />}
            Stop
          </Button>
        ) : (
          <Button size="sm" disabled={!canStart} onClick={() => setConfirmOpen(true)}>
            <Rocket aria-hidden="true" />
            {autoPilot.stoppedAt ? 'Restart auto-pilot' : 'Make the whole episode'}
          </Button>
        )}
      </div>

      {autoPilot.isRunning ? (
        <div className="border-border bg-surface-raised flex flex-wrap items-baseline justify-between gap-2 rounded-xl border p-3">
          <span className="text-foreground-muted text-sm">
            {currencyTotalFormat.format(spent)} spent of{' '}
            {currencyTotalFormat.format(autoPilot.budgetUsd ?? 0)}
          </span>
          <span className="text-foreground-subtle text-xs">
            {work.stages.length} stage{work.stages.length === 1 ? '' : 's'} to go
          </span>
        </div>
      ) : null}

      {/* The stop reason outlives the run on purpose: "it stopped and I don't know why" is the
          failure mode that makes an unattended feature untrustworthy. */}
      {!autoPilot.isRunning && autoPilot.stopReason ? (
        <p className="text-foreground-muted border-border bg-surface-raised rounded-xl border p-3 text-sm">
          Last run: {autoPilot.stopReason}
        </p>
      ) : null}

      {!autoPilot.isRunning && work.stages.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-foreground-muted text-sm">
            {work.stages.map((kind) => STAGE_LABELS[kind]).join(' → ')}
          </p>
          <p className="text-foreground-subtle text-xs">
            Roughly {currencyTotalFormat.format(work.totalUsd)} and {formatEta(work.etaSeconds)} in
            total.
          </p>
        </div>
      ) : null}

      {blockedReasons.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {blockedReasons.map((reason) => (
            <li key={reason} className="text-warning-text text-xs">
              {reason}
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run the rest of this episode?</DialogTitle>
            <DialogDescription>
              Auto-pilot will approve {work.stages.map((kind) => STAGE_LABELS[kind]).join(', ')} one
              after another without asking. It stops the moment the next stage would push the total
              past your budget, and it stops on the first failure.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <NumberInputField
              label="Budget for this episode (USD)"
              minValue={0.01}
              maxValue={1000}
              step={0.5}
              value={chosenBudget}
              onChange={setBudget}
            />
            <p className="text-foreground-subtle text-xs">
              Forecast for the remaining stages is {currencyTotalFormat.format(work.totalUsd)}
              {spent > 0 ? `, on top of ${currencyTotalFormat.format(spent)} already spent` : ''}.
              The suggested cap adds 25% because the forecast is an order-of-magnitude estimate, not
              a quote.
            </p>
            <p className="text-foreground-subtle text-xs">
              Stopping later prevents the next stage from starting — a stage already generating is
              already paid for and will finish.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              disabled={startAutoPilot.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              isLoading={startAutoPilot.isPending}
              onClick={() =>
                startAutoPilot.mutate(chosenBudget, { onSettled: () => setConfirmOpen(false) })
              }
            >
              {startAutoPilot.isPending
                ? 'Starting…'
                : `Start, cap at ${currencyTotalFormat.format(chosenBudget)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
AutoPilotPanel.displayName = 'AutoPilotPanel';

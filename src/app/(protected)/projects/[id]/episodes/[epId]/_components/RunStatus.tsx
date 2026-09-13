'use client';

import { useEffect, useState } from 'react';

import { Progress } from '@/components/ui/Progress';
import { Spinner } from '@/components/ui/Spinner';

import { formatEta } from '@/lib/cost-forecast';
import { cn } from '@/lib/cn';

/**
 * What a running stage looks like while it runs.
 *
 * A generating stage used to render a bare `<Skeleton />` — a grey box that says nothing for the
 * several minutes a video batch takes: not what is running, not how long it has been running, not
 * how far in it is. These pieces replace it with the three facts a person waiting actually wants.
 */

/** Ticks once a second while `startedAt` is set, so the elapsed time is live rather than frozen. */
export function useElapsedSeconds(startedAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!startedAt) return null;
  return Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
}

export function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${String(rest).padStart(2, '0')}s` : `${rest}s`;
}

export interface RunStatusProps {
  /** What is being produced, e.g. "Writing the scene breakdown". Shown whenever `activity` is not. */
  label: string;
  /**
   * The stage's live "what's happening right now" line — e.g. `Searching "..."` — reported by the
   * research agent as it works. Takes over the headline from `label` when present, so the person
   * waiting sees the actual step instead of a static "Researching the web" for minutes at a time.
   */
  activity?: string | null | undefined;
  startedAt: string | null;
  /** Forecast ETA in seconds — turns the elapsed counter into a progress bar. */
  etaSeconds?: number | undefined;
  /** Countable sub-units, e.g. scenes generated so far. Shown instead of the ETA bar when given. */
  progress?: { done: number; total: number } | undefined;
  className?: string;
}

/**
 * Progress against a *forecast* is a guess, not a measurement, so the bar is capped at 95% and
 * never claims completion — the stage flipping to READY is the only thing that says "done".
 */
function etaRatio(elapsed: number, etaSeconds: number): number {
  if (etaSeconds <= 0) return 0;
  return Math.min(0.95, elapsed / etaSeconds);
}

export function RunStatus({ label, activity, startedAt, etaSeconds, progress, className }: RunStatusProps) {
  const elapsed = useElapsedSeconds(startedAt);
  const ratio = progress
    ? progress.total > 0
      ? progress.done / progress.total
      : 0
    : elapsed !== null && etaSeconds
      ? etaRatio(elapsed, etaSeconds)
      : 0;
  const headline = activity || label;

  return (
    <div
      className={cn(
        'border-primary/20 bg-primary-subtle flex flex-col gap-2.5 rounded-xl border p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-foreground flex min-w-0 items-center gap-2 text-sm font-medium">
          <Spinner size="sm" className="shrink-0 text-primary-text" label={headline} />
          <span key={headline} className="animate-fade-in truncate" title={headline}>
            {headline}
          </span>
        </span>
        <span className="text-foreground-muted shrink-0 text-xs tabular-nums">
          {elapsed === null ? 'starting…' : formatElapsed(elapsed)}
          {progress
            ? ` · ${progress.done}/${progress.total}`
            : etaSeconds
              ? ` of ${formatEta(etaSeconds)}`
              : ''}
        </span>
      </div>
      {activity ? <p className="text-foreground-subtle text-xs">{label}</p> : null}

      <Progress value={Math.round(ratio * 100)} aria-label={label} className="bg-primary/15" />

      {elapsed !== null && etaSeconds && elapsed > etaSeconds ? (
        <p className="text-foreground-muted text-xs">
          Running longer than the {formatEta(etaSeconds)} estimate — providers queue, this is not
          stuck yet.
        </p>
      ) : null}
    </div>
  );
}
RunStatus.displayName = 'RunStatus';

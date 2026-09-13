import { cn } from '@/lib/cn';

/**
 * EpisodeStatus | StageStatus | AssetStatus → one chip.
 *
 * A dot carries the state and the text names it, so the chip stays legible at a glance in a dense
 * table without relying on hue alone. `GENERATING` pulses — it is the only status that means
 * "something is happening right now".
 */

type Tone = 'neutral' | 'running' | 'review' | 'done' | 'failed';

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  PENDING: 'neutral',
  ARCHIVED: 'neutral',
  GENERATING: 'running',
  READY: 'review',
  READY_FOR_REVIEW: 'review',
  APPROVED: 'done',
  DONE: 'done',
  ACTIVE: 'done',
  FAILED: 'failed',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  GENERATING: 'Generating',
  READY_FOR_REVIEW: 'Ready for review',
  DONE: 'Done',
  FAILED: 'Failed',
  PENDING: 'Pending',
  READY: 'Ready',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

const TONE_CHIP: Record<Tone, string> = {
  neutral: 'border-border bg-background text-foreground-muted',
  running: 'border-primary/20 bg-primary-subtle text-primary-text',
  review: 'border-warning/25 bg-warning-subtle text-warning-text',
  done: 'border-success/25 bg-success-subtle text-success',
  failed: 'border-destructive/20 bg-destructive-subtle text-destructive-text',
};

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-foreground-subtle',
  running: 'bg-primary animate-pulse',
  review: 'bg-warning',
  done: 'bg-success',
  failed: 'bg-destructive',
};

export interface StatusChipProps {
  /** Raw enum value — the visible label is looked up from STATUS_LABEL. */
  status: string;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const tone = STATUS_TONE[status] ?? 'neutral';

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        TONE_CHIP[tone],
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden="true" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
StatusChip.displayName = 'StatusChip';

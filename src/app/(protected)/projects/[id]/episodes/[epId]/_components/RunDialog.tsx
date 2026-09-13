'use client';

import { AlertTriangle, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { cn } from '@/lib/cn';
import { formatEta, type StageForecast } from '@/lib/cost-forecast';

import { currencyFormat } from './rooms';

export interface RunDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One sentence saying what will happen — including what it will overwrite. */
  description: string;
  /** Priced work this action starts. Omitted for actions that spend nothing. */
  forecast?: StageForecast | undefined;
  /** Optional steer passed to the generator. Omit the prop entirely for actions that take no note. */
  note?: { value: string; onChange: (value: string) => void; placeholder: string };
  confirmLabel: string;
  pendingLabel?: string;
  isPending?: boolean;
  isDanger?: boolean;
  onConfirm: () => void;
}

function ForecastTable({ forecast }: { forecast: StageForecast }) {
  if (forecast.isFree) {
    return (
      <p className="text-foreground-muted text-sm">
        Nothing to pay for — this stage runs locally. About {formatEta(forecast.etaSeconds)}.
      </p>
    );
  }

  return (
    <div className="border-border bg-surface-raised flex flex-col gap-2 rounded-md border p-3">
      <ul className="flex flex-col gap-1">
        {forecast.lines.map((line) => (
          <li
            key={line.label}
            className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
          >
            <span className="text-foreground-muted">
              {line.label}
              <span className="text-foreground-subtle"> · {line.model}</span>
            </span>
            <span className="text-foreground-muted">
              {line.usd === null ? 'unpriced' : currencyFormat.format(line.usd)}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-border flex flex-wrap items-baseline justify-between gap-2 border-t pt-2">
        <span className="text-foreground text-sm font-medium">
          {forecast.hasUnpricedModel ? 'At least' : 'Roughly'}{' '}
          {currencyFormat.format(forecast.totalUsd)}
        </span>
        <span className="text-foreground-subtle text-xs">{formatEta(forecast.etaSeconds)}</span>
      </div>
      <p className="text-foreground-subtle text-xs">
        Order-of-magnitude estimate from the configured models
        {forecast.hasUnpricedModel
          ? ' — one model has no price on file, so the real cost is higher.'
          : '.'}
      </p>
    </div>
  );
}

/**
 * Every action that spends money or destroys work goes through here.
 *
 * It replaces the old pattern where a button relabelled itself ("Regenerate" → "Confirm
 * regenerate") on first click: that made the first click do nothing visible, gave the same gesture
 * three different meanings across the room, and never said what the run would cost. Here the cost
 * and the ETA are on screen *before* the commitment, and the note lives with the confirmation
 * instead of appearing beneath an already-pressed button.
 */
export function RunDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  forecast,
  note,
  confirmLabel,
  pendingLabel,
  isPending = false,
  isDanger = false,
  onConfirm,
}: RunDialogProps) {
  const Icon = isDanger ? AlertTriangle : Sparkles;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        // Escape/outside-click would abandon a run that is already in flight; while pending the
        // only way out is the action resolving.
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
                isDanger
                  ? 'bg-destructive-subtle text-destructive-text'
                  : 'bg-primary-subtle text-primary-text',
              )}
              aria-hidden="true"
            >
              <Icon />
            </span>
            <div className="flex flex-col gap-1.5">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {forecast || note ? (
          <div className="flex flex-col gap-4">
            {forecast ? <ForecastTable forecast={forecast} /> : null}
            {note ? (
              <TextAreaField
                label="Note for this run (optional)"
                value={note.value}
                onChange={note.onChange}
                rows={2}
                placeholder={note.placeholder}
              />
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={isDanger ? 'destructive' : 'primary'}
            isLoading={isPending}
            onClick={onConfirm}
          >
            {isPending ? (pendingLabel ?? 'Working…') : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
RunDialog.displayName = 'RunDialog';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Nothing here yet — and what to do about it.
 *
 * Every empty surface in the studio uses this rather than a bare sentence, because "no episodes
 * yet" without a button next to it makes the user go looking for the action somewhere else on the
 * page. The icon sits in a tinted disc so the block has a centre of gravity on an otherwise blank
 * card.
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** The one obvious next move. */
  action?: ReactNode;
  /** Dashed border — for a slot inside an existing card, rather than a page-level empty screen. */
  isInset?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  isInset = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl px-6 text-center',
        isInset
          ? 'border-border bg-surface-raised border border-dashed py-10'
          : 'elevation-sm border-border bg-surface border py-16',
        className,
      )}
    >
      {Icon ? (
        <span className="bg-primary-subtle text-primary-text flex size-11 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-foreground text-base font-semibold">{title}</p>
        {description ? (
          <p className="text-foreground-muted mx-auto max-w-sm text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
EmptyState.displayName = 'EmptyState';

'use client';

import type { ReactNode } from 'react';

import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/cn';

/**
 * The shell every labelled field in the studio shares: label row (with an optional right-aligned
 * action), the control, and exactly one line of help — the error replaces the hint rather than
 * stacking under it, so a field never changes height when it goes invalid.
 */
export interface FieldShellProps {
  id: string;
  label?: string | undefined;
  /** Rendered inline with the label, right-aligned — e.g. an "AI refine" trigger. */
  labelAction?: ReactNode;
  hint?: string | undefined;
  error?: string | undefined;
  isRequired?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function FieldShell({
  id,
  label,
  labelAction,
  hint,
  error,
  isRequired,
  className,
  children,
}: FieldShellProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label || labelAction ? (
        <div className="flex min-h-5 items-center justify-between gap-2">
          {label ? (
            <Label htmlFor={id}>
              {label}
              {isRequired ? <span className="text-destructive-text ml-0.5">*</span> : null}
            </Label>
          ) : (
            <span />
          )}
          {labelAction}
        </div>
      ) : null}

      {children}

      {error ? (
        <p id={describedBy} className="text-destructive-text text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-foreground-muted text-xs leading-relaxed">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** `aria-describedby` target for the control inside a `FieldShell`. */
export function fieldDescribedBy(id: string, hint?: string, error?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

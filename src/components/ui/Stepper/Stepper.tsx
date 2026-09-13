'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';

export interface StepperStep {
  id: string;
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Zero-based index of the step being shown. */
  current: number;
  /** Jump to an already-visited step. Omit to make the stepper display-only. */
  onStepChange?: (index: number) => void;
  /** Highest step index the user is allowed to jump to — defaults to `current`. */
  maxReachable?: number;
  className?: string;
}

/** Horizontal step indicator for the project wizard: completed → current → upcoming. */
export function Stepper({ steps, current, onStepChange, maxReachable, className }: StepperProps) {
  const reachable = maxReachable ?? current;

  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        {steps.map((step, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;
          const canJump = Boolean(onStepChange) && index <= reachable && !isCurrent;

          return (
            <li key={step.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!canJump}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={canJump ? () => onStepChange?.(index) : undefined}
                className={cn(
                  'flex flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
                  canJump && 'hover:bg-surface-raised',
                  'focus-visible:ring-primary/25 focus-visible:ring-4 focus-visible:outline-none',
                  'disabled:cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                    isComplete && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-primary-subtle text-primary-text',
                    !isComplete && !isCurrent && 'border-border text-foreground-subtle',
                  )}
                >
                  {isComplete ? <Check aria-hidden className="size-3.5" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-sm font-medium',
                      isCurrent ? 'text-foreground' : 'text-foreground-muted',
                    )}
                  >
                    {step.label}
                  </span>
                  {step.description ? (
                    <span className="text-foreground-subtle block truncate text-xs">
                      {step.description}
                    </span>
                  ) : null}
                </span>
              </button>

              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    'hidden h-px flex-1 sm:block',
                    index < current ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
Stepper.displayName = 'Stepper';

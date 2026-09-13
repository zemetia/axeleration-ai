'use client';

import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';

import { FieldShell, fieldDescribedBy } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

export interface NumberInputFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  value?: number;
  onChange?: (value: number) => void;
  minValue?: number;
  maxValue?: number;
  step?: number;
  isRequired?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  fullWidth?: boolean;
  className?: string;
  id?: string;
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

const STEP_BUTTON =
  'flex h-10 w-10 shrink-0 items-center justify-center text-foreground-muted transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4';

export function NumberInputField({
  label,
  hint,
  error,
  value,
  onChange,
  minValue,
  maxValue,
  step = 1,
  isRequired,
  isDisabled,
  isInvalid,
  fullWidth = true,
  className,
  id,
}: NumberInputFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const current = value ?? minValue ?? 0;

  const commit = (next: number) => {
    if (Number.isNaN(next)) return;
    onChange?.(clamp(next, minValue, maxValue));
  };

  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      isRequired={isRequired}
      className={cn(fullWidth && 'w-full', className)}
    >
      <div
        className={cn(
          'border-input bg-surface flex h-10 w-full items-center overflow-hidden rounded-lg border',
          'transition-[border-color,box-shadow] duration-150',
          'focus-within:border-primary focus-within:ring-primary/15 focus-within:ring-4',
          (Boolean(error) || isInvalid) && 'border-destructive ring-destructive/15 ring-4',
          isDisabled && 'bg-background opacity-60',
        )}
      >
        <button
          type="button"
          aria-label="Decrease"
          className={cn(STEP_BUTTON, 'border-border border-r')}
          disabled={isDisabled || (minValue !== undefined && current <= minValue)}
          onClick={() => commit(current - step)}
        >
          <Minus aria-hidden="true" />
        </button>

        {/* `type="text"` with a numeric inputMode, not `type="number"`: the stepper buttons are
            the affordance here, and a native number input adds its own spinners, silently swallows
            non-numeric keys, and reports itself as a spinbutton rather than a labelled textbox. */}
        <input
          id={fieldId}
          type="text"
          inputMode="numeric"
          value={value ?? ''}
          required={isRequired}
          disabled={isDisabled}
          aria-invalid={Boolean(error) || isInvalid || undefined}
          aria-describedby={fieldDescribedBy(fieldId, hint, error)}
          onChange={(event) => {
            const next = event.target.value.trim();
            if (next === '') return;
            commit(Number(next));
          }}
          className={cn(
            'text-foreground h-full min-w-0 flex-1 bg-transparent px-3 text-center text-sm tabular-nums',
            'focus:outline-none disabled:cursor-not-allowed',
          )}
        />

        <button
          type="button"
          aria-label="Increase"
          className={cn(STEP_BUTTON, 'border-border border-l')}
          disabled={isDisabled || (maxValue !== undefined && current >= maxValue)}
          onClick={() => commit(current + step)}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </FieldShell>
  );
}
NumberInputField.displayName = 'NumberInputField';

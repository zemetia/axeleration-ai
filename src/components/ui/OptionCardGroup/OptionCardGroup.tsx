'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';

import { cn } from '@/lib/cn';

export interface OptionCard<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

export interface OptionCardGroupProps<T extends string = string> {
  label?: string;
  hint?: string;
  error?: string;
  options: OptionCard<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Cards per row on `sm` and up. */
  columns?: 1 | 2 | 3;
  className?: string;
}

/**
 * Radio group rendered as selectable cards — for short, meaningful choices (project type,
 * research mode) where the description matters as much as the label. Built on native radio
 * inputs for the same reason `SelectField` uses a native `<select>`: real keyboard/AT behaviour
 * for free, styled against the design tokens.
 */
export function OptionCardGroup<T extends string = string>({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  columns = 2,
  className,
}: OptionCardGroupProps<T>) {
  const name = useId();

  return (
    <fieldset className={cn('flex w-full flex-col gap-2', className)}>
      {label ? <legend className="text-foreground mb-2 text-sm font-medium">{label}</legend> : null}

      <div
        className={cn(
          'grid gap-3',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-3',
        )}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'group relative flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors',
                'has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-background has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary-subtle'
                  : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isSelected ? 'text-primary-text' : 'text-foreground',
                  )}
                >
                  {option.label}
                </span>
                {isSelected ? (
                  <Check aria-hidden className="text-primary-text size-4 shrink-0" />
                ) : null}
              </span>
              {option.description ? (
                <span className="text-foreground-muted text-xs leading-relaxed">
                  {option.description}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      {error ? (
        <p className="text-destructive-text text-xs">{error}</p>
      ) : hint ? (
        <p className="text-foreground-muted text-xs">{hint}</p>
      ) : null}
    </fieldset>
  );
}
OptionCardGroup.displayName = 'OptionCardGroup';

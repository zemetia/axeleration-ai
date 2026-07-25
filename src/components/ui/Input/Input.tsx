import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

const inputVariants = cva(
  [
    'flex w-full rounded-md border bg-surface text-foreground',
    'placeholder:text-foreground-subtle',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'file:border-0 file:bg-transparent file:font-medium',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 px-2.5 text-xs file:text-xs',
        md: 'h-9 px-3 text-sm file:text-sm',
        lg: 'h-10 px-4 text-base file:text-base',
      },
      inputState: {
        default: 'border-input hover:border-border-strong',
        error: 'border-destructive focus-visible:ring-destructive',
        success: 'border-success focus-visible:ring-success',
      },
    },
    defaultVariants: {
      size: 'md',
      inputState: 'default',
    },
  },
);

export type InputVariants = VariantProps<typeof inputVariants>;

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    Pick<InputVariants, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { size, label, hint, error, leftAddon, rightAddon, className, id, required, ...props },
    ref,
  ) => {
    const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const inputState: InputVariants['inputState'] = error ? 'error' : 'default';

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
            {required && (
              <span className="ml-0.5 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {leftAddon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-foreground-muted">
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={cn(
              inputVariants({ size, inputState }),
              leftAddon && 'pl-9',
              rightAddon && 'pr-9',
              className,
            )}
            {...props}
          />

          {rightAddon && (
            <div className="pointer-events-none absolute right-3 flex items-center text-foreground-muted">
              {rightAddon}
            </div>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-foreground-subtle">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

'use client';

import { ChevronDown } from 'lucide-react';
import { useId, type SelectHTMLAttributes } from 'react';

import { FieldShell, fieldDescribedBy } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

export interface SelectFieldOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'className' | 'children'
> {
  label?: string;
  hint?: string;
  error?: string;
  isRequired?: boolean;
  fullWidth?: boolean;
  className?: string;
  options: SelectFieldOption[];
}

/**
 * A native <select> in the same shell as the text fields. For the fixed, short option lists in
 * this app the native control is simpler than a Radix popover and just as accessible; the Radix
 * `Select` primitive is there for the cases that need custom option rendering.
 */
export function SelectField({
  label,
  hint,
  error,
  isRequired,
  fullWidth = true,
  className,
  options,
  id,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      isRequired={isRequired}
      className={cn(fullWidth && 'w-full', className)}
    >
      <div className="relative">
        <select
          id={fieldId}
          required={isRequired}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={fieldDescribedBy(fieldId, hint, error)}
          className={cn(
            'border-input bg-surface text-foreground h-10 w-full appearance-none rounded-lg border pr-9 pl-3.5 text-sm',
            'transition-[border-color,box-shadow] duration-150',
            'hover:border-border-strong',
            'focus-visible:border-primary focus-visible:ring-primary/15 focus-visible:ring-4 focus-visible:outline-none',
            'disabled:bg-background disabled:cursor-not-allowed disabled:opacity-60',
            error && 'border-destructive ring-destructive/15 ring-4',
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="text-foreground-subtle pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        />
      </div>
    </FieldShell>
  );
}
SelectField.displayName = 'SelectField';

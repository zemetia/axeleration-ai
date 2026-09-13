'use client';

import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

import { FieldShell, fieldDescribedBy } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/cn';

export interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange' | 'value' | 'className'
> {
  label?: string;
  /** Rendered inline with the label, right-aligned — e.g. an "AI refine" trigger. */
  labelAction?: ReactNode;
  hint?: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function TextAreaField({
  label,
  labelAction,
  hint,
  error,
  value,
  onChange,
  isRequired,
  isDisabled,
  isInvalid,
  fullWidth = true,
  className,
  rows = 4,
  id,
  ...props
}: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell
      id={fieldId}
      label={label}
      labelAction={labelAction}
      hint={hint}
      error={error}
      isRequired={isRequired}
      className={cn(fullWidth && 'w-full', className)}
    >
      <Textarea
        {...props}
        id={fieldId}
        rows={rows}
        // See TextInputField: controlled only when the caller holds the value, otherwise an
        // uncontrolled field is pinned to '' and loses every keystroke but the last.
        {...(value === undefined ? {} : { value })}
        onChange={(event) => onChange?.(event.target.value)}
        required={isRequired}
        disabled={isDisabled}
        aria-invalid={Boolean(error) || isInvalid || undefined}
        aria-describedby={fieldDescribedBy(fieldId, hint, error)}
      />
    </FieldShell>
  );
}
TextAreaField.displayName = 'TextAreaField';

'use client';

import { useId, type InputHTMLAttributes } from 'react';

import { FieldShell, fieldDescribedBy } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

/**
 * Value-based `onChange(value)` — kept from the HeroUI original this replaced, because every call
 * site in the studio passes a state setter straight in (`onChange={setTitle}`).
 */
export interface TextInputFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'className'
> {
  label?: string;
  hint?: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  fullWidth?: boolean;
  className?: string;
  inputClassName?: string;
}

export function TextInputField({
  label,
  hint,
  error,
  value,
  onChange,
  isRequired,
  isDisabled,
  isInvalid,
  fullWidth = true,
  className,
  inputClassName,
  type = 'text',
  id,
  ...props
}: TextInputFieldProps) {
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
      <Input
        {...props}
        id={fieldId}
        type={type}
        // Controlled only when the caller actually holds the value. Passing `value ?? ''`
        // unconditionally pins an uncontrolled field to the empty string, so every keystroke
        // is wiped and `onChange` only ever reports the last character typed.
        {...(value === undefined ? {} : { value })}
        onChange={(event) => onChange?.(event.target.value)}
        required={isRequired}
        disabled={isDisabled}
        aria-invalid={Boolean(error) || isInvalid || undefined}
        aria-describedby={fieldDescribedBy(fieldId, hint, error)}
        className={inputClassName}
      />
    </FieldShell>
  );
}
TextInputField.displayName = 'TextInputField';

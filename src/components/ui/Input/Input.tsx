import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'border-input bg-surface text-foreground flex h-10 w-full rounded-lg border px-3.5 text-sm',
        'transition-[border-color,box-shadow] duration-150',
        'placeholder:text-foreground-subtle',
        'hover:border-border-strong',
        'focus-visible:border-primary focus-visible:ring-primary/15 focus-visible:ring-4 focus-visible:outline-none',
        'disabled:bg-background disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/15 aria-invalid:ring-4',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'border-input bg-surface text-foreground flex min-h-20 w-full resize-y rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed',
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
Textarea.displayName = 'Textarea';

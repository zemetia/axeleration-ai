import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5 rounded-full font-medium',
    'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-surface-raised text-foreground-muted border border-border',
        outline: 'border border-border bg-transparent text-foreground-muted',
        destructive: 'bg-destructive-subtle text-destructive border border-destructive/30',
        success: 'bg-success-subtle text-success border border-success/30',
        warning: 'bg-warning-subtle text-warning border border-warning/30',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, BadgeVariants {
  dot?: boolean;
}

export function Badge({ variant, size, dot, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

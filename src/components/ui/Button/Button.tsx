import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
    'active:scale-[0.985]',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25',
    'disabled:pointer-events-none disabled:opacity-45',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: ['elevation-sm bg-primary text-primary-foreground', 'hover:bg-primary-hover'],
        secondary: [
          'bg-surface-raised text-foreground border border-border',
          'hover:border-border-strong hover:bg-background',
        ],
        outline: [
          'elevation-sm border border-border bg-surface text-foreground',
          'hover:border-border-strong hover:bg-surface-raised',
        ],
        ghost: [
          'bg-transparent text-foreground-muted',
          'hover:bg-surface-raised hover:text-foreground',
        ],
        destructive: [
          'elevation-sm bg-destructive text-destructive-foreground',
          'hover:bg-destructive-hover',
          'focus-visible:ring-destructive/25',
        ],
        'destructive-outline': [
          'border border-destructive/30 bg-surface text-destructive-text',
          'hover:bg-destructive-subtle',
          'focus-visible:ring-destructive/25',
        ],
        link: ['text-primary-text underline-offset-4 hover:underline'],
      },
      size: {
        xs: 'h-7 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5',
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {
  asChild?: boolean;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant, size, fullWidth, asChild, isLoading, className, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        disabled={disabled ?? isLoading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {isLoading && <Loader2 className="animate-spin" aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

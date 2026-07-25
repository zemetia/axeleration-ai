import { cva, type VariantProps } from 'class-variance-authority';
import type { ElementType, HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const typographyVariants = cva('', {
  variants: {
    variant: {
      h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
      h2: 'scroll-m-20 text-3xl font-semibold tracking-tight',
      h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
      h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
      h5: 'scroll-m-20 text-lg font-semibold tracking-tight',
      h6: 'scroll-m-20 text-base font-semibold tracking-tight',
      p: 'leading-7',
      lead: 'text-xl leading-relaxed',
      large: 'text-lg font-semibold',
      small: 'text-sm font-medium leading-none',
      muted: 'text-sm text-foreground-muted leading-relaxed',
      code: 'relative rounded-sm bg-surface-raised px-1.5 py-0.5 font-mono text-sm font-semibold',
    },
  },
  defaultVariants: {
    variant: 'p',
  },
});

const VARIANT_ELEMENT_MAP = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  p: 'p',
  lead: 'p',
  large: 'p',
  small: 'small',
  muted: 'p',
  code: 'code',
} as const satisfies Record<
  NonNullable<VariantProps<typeof typographyVariants>['variant']>,
  string
>;

type TypographyVariant = keyof typeof VARIANT_ELEMENT_MAP;

export interface TypographyProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
  as?: ElementType;
}

export function Typography({
  variant = 'p',
  as,
  className,
  children,
  ...props
}: TypographyProps) {
  const Component = as ?? (VARIANT_ELEMENT_MAP[variant as TypographyVariant] ?? 'p');

  return (
    <Component className={cn(typographyVariants({ variant }), className)} {...props}>
      {children}
    </Component>
  );
}

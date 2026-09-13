import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';

const SIZES = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const;

export interface SpinnerProps {
  size?: keyof typeof SIZES;
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={cn('animate-spin', SIZES[size], className)}
    />
  );
}
Spinner.displayName = 'Spinner';

import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-border animate-pulse rounded-md', className)} {...props} />;
}

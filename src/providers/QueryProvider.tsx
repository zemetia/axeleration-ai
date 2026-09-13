'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { makeQueryClient } from '@/lib/query-client';

// Statically importing the devtools makes every dev page compile (and download) the whole
// devtools panel before it can render. It is a dev-only tool — load it lazily, and not at all
// in production.
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(
        () => import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools),
        { ssr: false },
      )
    : () => null;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Same config the server prefetch uses — see `makeQueryClient`. A mismatched `staleTime`
  // would make every hydrated query refetch on mount.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

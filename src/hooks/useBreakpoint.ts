'use client';

import { useSyncExternalStore } from 'react';

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const minWidth = BREAKPOINTS[breakpoint];

  return useSyncExternalStore(
    (callback) => {
      const query = window.matchMedia(`(min-width: ${minWidth}px)`);
      query.addEventListener('change', callback);
      return () => query.removeEventListener('change', callback);
    },
    () => window.matchMedia(`(min-width: ${minWidth}px)`).matches,
    () => false,
  );
}

export function useIsMobile(): boolean {
  return !useBreakpoint('md');
}

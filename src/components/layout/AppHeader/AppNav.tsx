'use client';

import { LayoutGrid, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { href: '/dashboard' as const, label: 'Projects', icon: LayoutGrid },
  { href: '/settings' as const, label: 'Settings', icon: Settings },
];

/**
 * Two destinations, always visible, with the current one filled in. Split out of `AppHeader` only
 * because the active state needs `usePathname` — the header itself stays a server component.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex items-center gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        // `/settings` must not light up while you are inside `/projects/x/settings`.
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-subtle text-primary-text'
                : 'text-foreground-muted hover:bg-surface-raised hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
AppNav.displayName = 'AppNav';

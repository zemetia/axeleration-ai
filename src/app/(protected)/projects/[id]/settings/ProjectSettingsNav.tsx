'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

import { SETTINGS_NAV_ITEMS, settingsHref } from './settings-nav-items';

export interface ProjectSettingsNavProps {
  projectId: string;
}

/**
 * Sub-page menu for project settings. Vertical rail on desktop, horizontal scroller on mobile —
 * the same links either way so the active page always reads the same.
 */
export function ProjectSettingsNav({ projectId }: ProjectSettingsNavProps) {
  const pathname = usePathname();
  const root = settingsHref(projectId, '');

  return (
    <nav
      aria-label="Project settings"
      className="-mx-6 overflow-x-auto px-6 pb-1 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      <ul className="flex min-w-max gap-1 lg:sticky lg:top-24 lg:min-w-0 lg:flex-col">
        {SETTINGS_NAV_ITEMS.map((item) => {
          const href = settingsHref(projectId, item.segment);
          const isActive = item.segment ? pathname.startsWith(href) : pathname === root;
          const Icon = item.icon;

          return (
            <li key={item.segment || 'general'}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  'text-foreground-muted hover:bg-surface hover:text-foreground',
                  isActive && 'bg-primary-subtle text-foreground',
                  item.isDanger && 'hover:text-destructive-text',
                  item.isDanger && isActive && 'bg-destructive-subtle text-destructive-text',
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0 transition-colors',
                    isActive
                      ? item.isDanger
                        ? 'text-destructive-text'
                        : 'text-primary-text'
                      : 'text-foreground-subtle group-hover:text-foreground-muted',
                  )}
                />
                <span className="flex flex-col">
                  <span className="leading-tight font-medium">{item.label}</span>
                  <span className="text-foreground-subtle hidden text-xs leading-tight lg:block">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
ProjectSettingsNav.displayName = 'ProjectSettingsNav';

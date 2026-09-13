import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';

import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  /**
   * Omitted on the last crumb — the page you are already on is not a link.
   *
   * Typed `string`, not `Route`: under `typedRoutes` a template literal like
   * `/projects/${string}` is rejected because `string` could contain a slash, and a breadcrumb
   * trail is data assembled by the caller rather than a literal written at the `<Link>`. The cast
   * below is the one place that trade is made — see LEARN.md 2026-07-28 for why the rest of the
   * app builds hrefs inline instead.
   */
  href?: string;
}

export interface BreadcrumbsProps {
  items: Crumb[];
  className?: string;
}

/**
 * Where you are, one line, above the page title.
 *
 * The studio nests three levels deep (project → episode → room) and the only way back used to be a
 * hand-written "← Back to project" link on whichever page remembered to add one.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="text-foreground-subtle flex min-w-0 flex-wrap items-center gap-1 text-xs">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden="true" />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href as Route}
                  className="hover:text-foreground max-w-[16rem] truncate rounded transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-foreground-muted max-w-[16rem] truncate font-medium"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
Breadcrumbs.displayName = 'Breadcrumbs';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The first block on every studio page: where am I, what is this, what can I do here.
 *
 * It exists so those three answers land in the same place on every screen — the eyebrow reads as
 * the section, the title as the thing, the actions sit right-aligned on the title's baseline. Any
 * page-level status (a chip, a cost) goes in `meta`, under the title, never inside the title row.
 */
export interface PageHeaderProps {
  /** Small uppercase context label above the title, e.g. "Project" or "Episode 04". */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Chips, counts, timestamps — the line under the description. */
  meta?: ReactNode;
  /** Buttons, right-aligned on wide screens and wrapping below the title on narrow ones. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-4', className)}>
      <div className="flex max-w-3xl min-w-0 flex-col gap-1.5">
        {eyebrow ? <div className="text-eyebrow">{eyebrow}</div> : null}
        <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-foreground-muted text-sm leading-relaxed text-pretty">{description}</p>
        ) : null}
        {meta ? <div className="mt-1 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
PageHeader.displayName = 'PageHeader';

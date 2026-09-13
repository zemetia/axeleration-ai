'use client';

import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** `md` for reading an asset, `lg` for the two-column editor. */
  size?: 'md' | 'lg';
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Right-hand panel used for both reading and editing an asset. Hand-rolled rather than pulled
 * from HeroUI: the page needs the grid to stay visible and interactive underneath on wide
 * screens, and this is small enough that a dialog dependency would cost more than it saves.
 */
export function SlideOver({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  children,
}: SlideOverProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="animate-fade-in bg-foreground/20 absolute inset-0 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-slide-in-right border-border bg-surface relative flex h-full w-full flex-col border-l',
          'elevation-lg',
          size === 'lg' ? 'max-w-4xl' : 'max-w-xl',
        )}
      >
        <header className="border-border flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-foreground truncate text-lg font-semibold">{title}</div>
            {subtitle ? <div className="text-foreground-muted text-sm">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-foreground-muted hover:bg-surface-raised hover:text-foreground focus-visible:ring-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <footer className="border-border bg-background flex items-center justify-end gap-2 border-t px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
SlideOver.displayName = 'SlideOver';

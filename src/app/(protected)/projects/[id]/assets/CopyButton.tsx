'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * Copy-to-clipboard with its own confirmation.
 *
 * The confirmation is the whole point: a copy that looks identical before and after the click
 * leaves the user pasting into another tab to find out whether it worked. State is local and
 * self-clearing — nothing upstream cares that a string was copied.
 */

export interface CopyButtonProps {
  value: string;
  /** Idle label. Replaced by "Copied" for a beat after a successful write. */
  label?: string;
  className?: string;
}

export function CopyButton({ value, label = 'Copy', className }: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    } catch {
      // Denied permission or a non-secure context. Silent: the label simply never flips, which is
      // the honest signal — telling the user it copied when it did not is the worse failure.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        'border-border bg-surface text-foreground-muted hover:border-border-strong hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
    >
      {isCopied ? (
        <Check aria-hidden className="text-success size-3.5" />
      ) : (
        <Copy aria-hidden className="size-3.5" />
      )}
      {isCopied ? 'Copied' : label}
    </button>
  );
}
CopyButton.displayName = 'CopyButton';

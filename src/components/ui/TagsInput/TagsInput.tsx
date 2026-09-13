'use client';

import { X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

export interface TagsInputProps {
  label?: string;
  hint?: string;
  error?: string;
  /** Committed tags, already normalized by the caller. */
  value: string[];
  onChange: (tags: string[]) => void;
  /** One-click tags offered under the field; users can always type their own. */
  suggestions?: readonly string[];
  maxTags?: number;
  placeholder?: string;
  id?: string;
  className?: string;
}

/**
 * Comma-separated free-text tag entry. A tag commits on `,`, `Enter`, or blur; `Backspace`
 * on an empty input removes the last one. Values are lowercased and de-duplicated here so the
 * chips a user sees are exactly what the server will store.
 */
export function TagsInput({
  label,
  hint,
  error,
  value,
  onChange,
  suggestions,
  maxTags = 12,
  placeholder = 'cartoon, anime, realistic',
  id = 'tags-input',
  className,
}: TagsInputProps) {
  const [draft, setDraft] = useState('');
  const isFull = value.length >= maxTags;

  function commit(raw: string) {
    const next = [...value];
    for (const part of raw.split(',')) {
      const tag = part.trim().toLowerCase();
      if (tag && !next.includes(tag) && next.length < maxTags) next.push(tag);
    }
    setDraft('');
    if (next.length !== value.length) onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const openSuggestions = suggestions?.filter((tag) => !value.includes(tag)) ?? [];

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-foreground text-sm font-medium">
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          'border-input bg-surface flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5',
          'transition-[border-color,box-shadow] duration-150',
          'focus-within:border-primary focus-within:ring-primary/15 focus-within:ring-4',
          error && 'border-destructive ring-destructive/15 ring-4',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="bg-primary-subtle text-primary-text inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-primary-text/70 hover:text-primary-text focus-visible:ring-ring rounded-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
            >
              <X aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          disabled={isFull}
          aria-invalid={Boolean(error)}
          placeholder={value.length === 0 ? placeholder : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          className="text-foreground placeholder:text-foreground-subtle min-w-32 flex-1 bg-transparent px-1.5 text-sm focus-visible:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {openSuggestions.length > 0 && !isFull ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-foreground-subtle text-xs">Suggestions:</span>
          {openSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => commit(tag)}
              className="border-border text-foreground-muted hover:border-border-strong hover:text-foreground focus-visible:ring-ring rounded-md border px-2 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              + {tag}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive-text text-xs">{error}</p>
      ) : hint ? (
        <p className="text-foreground-muted text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
TagsInput.displayName = 'TagsInput';

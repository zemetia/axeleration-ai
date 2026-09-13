'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { FieldShell, fieldDescribedBy } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

export interface ComboboxFieldOption {
  value: string;
  label: string;
  /** Secondary line rendered under the label in the open list — e.g. a price or model id. */
  description?: string;
}

export interface ComboboxFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  isRequired?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  options: ComboboxFieldOption[];
  /** Selected option's `value`, or `''` for none. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  id?: string;
}

/**
 * A searchable `<select>`: click or focus opens a list filtered by what's typed, matched against
 * option labels. Built on `Popover` rather than `Select` because Radix `Select` has no search slot
 * and its content can't be styled around a text input — the popover just anchors a listbox to the
 * trigger and we own filtering/keyboard nav ourselves. Reach for `SelectField` instead when the
 * option list is short enough that scanning beats typing.
 */
export function ComboboxField({
  label,
  hint,
  error,
  isRequired,
  fullWidth = true,
  disabled,
  className,
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyText = 'No matches',
  id,
}: ComboboxFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listboxId = `${fieldId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  function openList() {
    if (disabled) return;
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    setQuery('');
  }

  function selectOption(option: ComboboxFieldOption) {
    onChange(option.value);
    closeList();
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) selectOption(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeList();
    }
  }

  const activeOption = filtered[activeIndex];
  const displayValue = open ? query : (selected?.label ?? '');

  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      isRequired={isRequired}
      className={cn(fullWidth && 'w-full', className)}
    >
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (next) openList();
          else closeList();
        }}
      >
        <PopoverPrimitive.Anchor asChild>
          <div className="relative">
            <input
              ref={inputRef}
              id={fieldId}
              type="text"
              role="combobox"
              autoComplete="off"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={fieldDescribedBy(fieldId, hint, error)}
              aria-activedescendant={open && activeOption ? `${listboxId}-${activeOption.value}` : undefined}
              disabled={disabled}
              placeholder={selected ? undefined : placeholder}
              value={displayValue}
              onFocus={openList}
              onClick={openList}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
                if (!open) setOpen(true);
              }}
              onKeyDown={handleKeyDown}
              className={cn(
                'border-input bg-surface text-foreground h-10 w-full rounded-lg border pr-9 pl-3.5 text-sm',
                'transition-[border-color,box-shadow] duration-150',
                'hover:border-border-strong',
                'focus-visible:border-primary focus-visible:ring-primary/15 focus-visible:ring-4 focus-visible:outline-none',
                'disabled:bg-background disabled:cursor-not-allowed disabled:opacity-60',
                error && 'border-destructive ring-destructive/15 ring-4',
              )}
            />
            <ChevronDown
              aria-hidden="true"
              className="text-foreground-subtle pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
            />
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className={cn(
              'elevation-md border-border bg-surface-overlay z-50 max-h-72 w-[var(--radix-popover-trigger-width)] overflow-auto rounded-md border p-1',
            )}
          >
            <ul id={listboxId} role="listbox" aria-label={label} className="flex flex-col gap-0.5">
              {filtered.length === 0 ? (
                <li className="text-foreground-subtle px-2 py-1.5 text-sm">{emptyText}</li>
              ) : (
                filtered.map((option, index) => (
                  <li
                    key={option.value}
                    id={`${listboxId}-${option.value}`}
                    role="option"
                    aria-selected={option.value === value}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                    className={cn(
                      'relative flex w-full cursor-pointer flex-col gap-0.5 rounded-sm py-1.5 pr-2 pl-8 select-none',
                      index === activeIndex && 'bg-surface-raised text-foreground',
                    )}
                  >
                    <span className="absolute top-1/2 left-2 flex size-3.5 -translate-y-1/2 items-center justify-center">
                      {option.value === value ? <Check className="size-4" /> : null}
                    </span>
                    <span className="text-sm">{option.label}</span>
                    {option.description ? (
                      <span className="text-foreground-muted text-xs">{option.description}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </FieldShell>
  );
}
ComboboxField.displayName = 'ComboboxField';

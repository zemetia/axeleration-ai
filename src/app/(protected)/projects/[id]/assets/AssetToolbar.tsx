'use client';

import { Archive, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { ASSET_TYPES, ASSET_TYPE_LABELS } from '@/config/asset-schema';
import { cn } from '@/lib/cn';
import type { AssetType } from '@prisma/client';

import { accentOf } from './asset-ui';

export interface AssetToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeType: AssetType | 'ALL';
  onTypeChange: (type: AssetType | 'ALL') => void;
  /** Counts for the *unfiltered* library, so a zero-count type still reads as "none yet". */
  countsByType: Record<AssetType, number>;
  totalCount: number;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
}

export function AssetToolbar({
  search,
  onSearchChange,
  activeType,
  onTypeChange,
  countsByType,
  totalCount,
  showArchived,
  onShowArchivedChange,
}: AssetToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            aria-hidden
            className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search handles, names, traits, palettes…"
            aria-label="Search assets"
            className={cn(
              'border-input bg-surface text-foreground h-10 w-full rounded-lg border pr-8 pl-9 text-sm',
              'placeholder:text-foreground-subtle transition-[border-color,box-shadow] duration-150',
              'hover:border-border-strong',
              'focus-visible:border-primary focus-visible:ring-primary/15 focus-visible:ring-4 focus-visible:outline-none',
            )}
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onSearchChange('')}
              className="text-foreground-subtle hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          aria-pressed={showArchived}
          onClick={() => onShowArchivedChange(!showArchived)}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm transition-colors',
            'focus-visible:ring-primary/25 focus-visible:ring-4 focus-visible:outline-none',
            showArchived
              ? 'border-primary/40 bg-primary-subtle text-primary-text'
              : 'border-border bg-surface text-foreground-muted hover:border-border-strong hover:text-foreground',
          )}
        >
          <Archive aria-hidden className="size-4" />
          Archived
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterPill
          isActive={activeType === 'ALL'}
          onClick={() => onTypeChange('ALL')}
          label="All"
          count={totalCount}
        />
        {ASSET_TYPES.map((type) => {
          const accent = accentOf(type);
          const Icon = accent.icon;
          return (
            <FilterPill
              key={type}
              isActive={activeType === type}
              onClick={() => onTypeChange(type)}
              label={ASSET_TYPE_LABELS[type]}
              count={countsByType[type] ?? 0}
              icon={
                <Icon
                  aria-hidden
                  className={cn('size-3.5', activeType === type ? undefined : accent.text)}
                />
              }
            />
          );
        })}
      </div>
    </div>
  );
}
AssetToolbar.displayName = 'AssetToolbar';

interface FilterPillProps {
  isActive: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: ReactNode;
}

function FilterPill({ isActive, onClick, label, count, icon }: FilterPillProps) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        'focus-visible:ring-primary/25 focus-visible:ring-4 focus-visible:outline-none',
        isActive
          ? 'bg-foreground text-background border-transparent'
          : 'border-border bg-surface text-foreground-muted hover:border-border-strong hover:text-foreground',
        count === 0 && !isActive && 'opacity-55',
      )}
    >
      {icon}
      {label}
      <span
        className={cn('tabular-nums', isActive ? 'text-background/70' : 'text-foreground-subtle')}
      >
        {count}
      </span>
    </button>
  );
}

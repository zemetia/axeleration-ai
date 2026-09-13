'use client';

import { Plus, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { AssetVO } from '@/types/value-objects';

import { AssetCard } from './AssetCard';

export interface AssetLibraryGridProps {
  projectId: string;
  assets: AssetVO[];
  isLoading: boolean;
  /** True when the project has assets but the current search/filter hides them all. */
  isFiltered: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
}

const GRID = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

export function AssetLibraryGrid({
  projectId,
  assets,
  isLoading,
  isFiltered,
  onCreate,
  onClearFilters,
}: AssetLibraryGridProps) {
  if (isLoading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="border-border bg-card overflow-hidden rounded-xl border">
            <div className="bg-surface-raised aspect-[4/5] w-full animate-pulse" />
            <div className="flex flex-col gap-2 p-3">
              <div className="bg-surface-raised h-3 w-16 animate-pulse rounded" />
              <div className="bg-surface-raised h-3.5 w-24 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="border-border bg-surface flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        {isFiltered ? (
          <>
            <SearchX aria-hidden className="text-foreground-subtle size-6" />
            <p className="text-foreground-muted text-sm">Nothing matches those filters.</p>
            <Button size="sm" variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          </>
        ) : (
          <>
            <p className="text-foreground text-base font-semibold">Your library is empty</p>
            <p className="text-foreground-muted max-w-md text-sm">
              Add a character, a style frame, or a location. Each one gets an @handle you can drop
              into any prompt — its reference image and details go with it every time.
            </p>
            <Button size="sm" onClick={onCreate}>
              <Plus aria-hidden />
              Add your first asset
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={GRID}>
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} projectId={projectId} />
      ))}
    </div>
  );
}
AssetLibraryGrid.displayName = 'AssetLibraryGrid';

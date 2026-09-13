'use client';

import { FlaskConical, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ASSET_TYPES } from '@/config/asset-schema';
import { useAssets } from '@/hooks/queries';
import type { AssetType } from '@prisma/client';

import { AssetEditor } from './AssetEditor';
import { AssetLibraryGrid } from './AssetLibraryGrid';
import { AssetToolbar } from './AssetToolbar';
import { searchTextOf } from './asset-ui';

export interface AssetLibraryContentProps {
  projectId: string;
}

export function AssetLibraryContent({ projectId }: AssetLibraryContentProps) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useAssets(projectId, undefined, showArchived ? 'ARCHIVED' : 'ACTIVE');
  const assets = useMemo(() => data ?? [], [data]);

  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<AssetType | 'ALL'>('ALL');
  const [isCreating, setIsCreating] = useState(false);

  const countsByType = useMemo(() => {
    const counts = Object.fromEntries(ASSET_TYPES.map((type) => [type, 0])) as Record<
      AssetType,
      number
    >;
    for (const asset of assets) counts[asset.type] += 1;
    return counts;
  }, [assets]);

  const visibleAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (activeType !== 'ALL' && asset.type !== activeType) return false;
      return query.length === 0 || searchTextOf(asset).includes(query);
    });
  }, [assets, activeType, search]);

  const isFiltered = search.trim().length > 0 || activeType !== 'ALL';

  function clearFilters() {
    setSearch('');
    setActiveType('ALL');
  }

  return (
    <div className="flex flex-col gap-5">
      {/* The explanation of what an asset is lives in the page header; this row is just the action,
          so the same sentence is not printed twice on one screen. */}
      {/* Two doors on purpose. The lab is the real one — it drafts the details and renders the
          asset from every angle its type needs — but an asset the user already has a reference for
          does not need a render, and making them walk through the lab to paste one line would be
          worse than either. */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="md" variant="outline" onClick={() => setIsCreating(true)}>
          <Plus aria-hidden />
          Quick add
        </Button>
        <Button size="md" asChild>
          <Link href={`/projects/${projectId}/assets/new`}>
            <FlaskConical aria-hidden />
            Open the asset lab
          </Link>
        </Button>
      </div>

      <AssetToolbar
        search={search}
        onSearchChange={setSearch}
        activeType={activeType}
        onTypeChange={setActiveType}
        countsByType={countsByType}
        totalCount={assets.length}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />

      <AssetLibraryGrid
        projectId={projectId}
        assets={visibleAssets}
        isLoading={isLoading}
        isFiltered={isFiltered}
        // An empty library is exactly where the lab pays for itself — send the first asset there.
        onCreate={() => router.push(`/projects/${projectId}/assets/new`)}
        onClearFilters={clearFilters}
      />

      {isCreating ? (
        <AssetEditor projectId={projectId} onClose={() => setIsCreating(false)} />
      ) : null}
    </div>
  );
}
AssetLibraryContent.displayName = 'AssetLibraryContent';

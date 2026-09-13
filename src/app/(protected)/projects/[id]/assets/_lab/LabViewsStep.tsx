'use client';

import { Anchor, Check, Mic2 } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectField } from '@/components/ui/SelectField';
import { viewPlanOf } from '@/config/asset-views';
import { cn } from '@/lib/cn';
import type { AssetVO } from '@/types/value-objects';
import type { AssetType } from '@prisma/client';

import { accentOf } from '../asset-ui';

export interface LabViewsStepProps {
  type: AssetType;
  selectedViewIds: string[];
  onToggleView: (viewId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  styleHandle: string;
  onStyleHandleChange: (handle: string) => void;
  styleAssets: AssetVO[];
  /** True when a reference image already locks the identity, so the anchor view is not special. */
  hasUploadedReference: boolean;
}

/**
 * The shot list. Which angles exist is per type (`src/config/asset-views.ts`) — this step only
 * decides which of them to pay for, and makes the anchor's role explicit, because "this one is
 * rendered first and everything else is rendered from it" is the single most useful thing to
 * understand before pressing Generate.
 */
export function LabViewsStep({
  type,
  selectedViewIds,
  onToggleView,
  onSelectAll,
  onSelectNone,
  styleHandle,
  onStyleHandleChange,
  styleAssets,
  hasUploadedReference,
}: LabViewsStepProps) {
  const plan = viewPlanOf(type);
  const accent = accentOf(type);

  if (plan.views.length === 0) {
    return (
      <EmptyState
        icon={Mic2}
        title="A voice has no viewpoints"
        description={plan.rationale}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-surface-raised flex flex-col gap-1 rounded-xl border p-4">
        <h3 className="text-foreground text-sm font-semibold">Why these angles</h3>
        <p className="text-foreground-muted text-sm">{plan.rationale}</p>
      </div>

      <SelectField
        label="Inherit a visual style"
        hint="Folds a STYLE asset's look into every view, so this asset matches the rest of the project."
        value={styleHandle}
        onChange={(event) => onStyleHandleChange(event.target.value)}
        options={[
          { value: '', label: styleAssets.length > 0 ? 'No style — render on its own' : 'No STYLE assets in this project yet' },
          ...styleAssets.map((asset) => ({ value: asset.handle, label: `@${asset.handle} — ${asset.name}` })),
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-foreground-muted text-sm">
          {selectedViewIds.length} of {plan.views.length} views selected
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onSelectNone}>
            Clear
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onSelectAll}>
            Select all
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {plan.views.map((view) => {
          const isSelected = selectedViewIds.includes(view.id);
          return (
            <button
              key={view.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => onToggleView(view.id)}
              className={cn(
                'flex gap-3 rounded-xl border p-4 text-left transition-all',
                'focus-visible:ring-primary/25 focus-visible:ring-4 focus-visible:outline-none',
                isSelected
                  ? cn(accent.border, accent.surface, 'elevation-sm')
                  : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                  isSelected ? cn(accent.border, 'bg-primary text-primary-foreground') : 'border-border',
                )}
              >
                {isSelected ? <Check aria-hidden className="size-3.5" /> : null}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground text-sm font-semibold">{view.label}</span>
                  <Badge variant="outline">{view.aspect}</Badge>
                  {view.panels?.length ? (
                    <Badge variant="secondary">{view.panels.length} panels</Badge>
                  ) : null}
                  {view.isAnchor && !hasUploadedReference ? (
                    <Badge variant="soft">
                      <Anchor aria-hidden />
                      Anchor
                    </Badge>
                  ) : null}
                </span>
                <span className="text-foreground-muted text-xs leading-relaxed">{view.purpose}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-foreground-subtle text-xs">
        {hasUploadedReference
          ? 'The reference image is the identity anchor — every view is rendered from it.'
          : 'The anchor view is rendered first from text; the rest are rendered from it, so the set stays consistent. If the anchor fails, nothing else runs.'}
      </p>
    </div>
  );
}
LabViewsStep.displayName = 'LabViewsStep';

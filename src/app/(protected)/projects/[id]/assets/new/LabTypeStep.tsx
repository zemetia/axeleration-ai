'use client';

import { Camera } from 'lucide-react';

import { ASSET_TYPES, assetSchemaOf } from '@/config/asset-schema';
import { viewPlanOf } from '@/config/asset-views';
import { cn } from '@/lib/cn';
import type { AssetType } from '@prisma/client';

import { accentOf } from '../asset-ui';

export interface LabTypeStepProps {
  value: AssetType;
  onChange: (type: AssetType) => void;
}

/**
 * The type decides both which fields the asset asks for and which angles it is photographed from,
 * so each card states the second half too — "8 views" is the difference between a character
 * turnaround and a map, and it is what the user is really choosing between here.
 */
export function LabTypeStep({ value, onChange }: LabTypeStepProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {ASSET_TYPES.map((type) => {
        const schema = assetSchemaOf(type);
        const accent = accentOf(type);
        const Icon = accent.icon;
        const viewCount = viewPlanOf(type).views.length;
        const isActive = type === value;

        return (
          <button
            key={type}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(type)}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-4 text-left transition-all',
              'focus-visible:ring-primary/25 focus-visible:ring-4 focus-visible:outline-none',
              isActive
                ? cn(accent.border, accent.surface, 'elevation-sm')
                : 'border-border bg-surface hover:border-border-strong hover:-translate-y-0.5',
            )}
          >
            <span className="flex items-center gap-2">
              <Icon aria-hidden className={cn('size-4', accent.text)} />
              <span className={cn('text-sm font-semibold', isActive ? accent.text : 'text-foreground')}>
                {schema.label}
              </span>
            </span>
            <span className="text-foreground-muted text-xs leading-relaxed">{schema.tagline}</span>
            <span className="text-foreground-subtle mt-auto flex items-center gap-1.5 pt-1 text-xs">
              <Camera aria-hidden className="size-3" />
              {viewCount > 0 ? `${viewCount} view${viewCount === 1 ? '' : 's'}` : 'audio only'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
LabTypeStep.displayName = 'LabTypeStep';

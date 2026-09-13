'use client';

import { AlertTriangle, Archive, ArchiveRestore, ImageOff, RotateCcw, Save } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { assetSchemaOf } from '@/config/asset-schema';
import { cn } from '@/lib/cn';
import { formatEta, type StageForecast } from '@/lib/cost-forecast';
import type { AssetType } from '@prisma/client';

import { accentOf } from '../asset-ui';

export interface AssetDetailRailProps {
  type: AssetType;
  name: string;
  handle: string;
  heroUrl?: string;
  isArchived: boolean;
  filledFieldCount: number;
  totalFieldCount: number;
  selectedViewCount: number;
  renderedViewCount: number;
  forecast: StageForecast;
  /** Missing image credential, stated once — the run would fail minutes in without it. */
  missingCredential?: string;
  isDirty: boolean;
  isSaving: boolean;
  saveError?: string;
  onSave: () => void;
  onDiscard: () => void;
  onToggleArchived: () => void;
  isStatusPending: boolean;
  updatedAt: string;
}

/**
 * The column that answers "what am I about to save, and what will the next render cost".
 *
 * Same rule the lab and the episode room settled on: the price goes on screen before the click, not
 * into the invoice after it. Save is the only control that writes — a rendered shot costs money the
 * moment it is rendered, but it does not become part of the asset until it is saved, so the dirty
 * state has to be visible from every pane rather than only from the one being edited.
 */
export function AssetDetailRail({
  type,
  name,
  handle,
  heroUrl,
  isArchived,
  filledFieldCount,
  totalFieldCount,
  selectedViewCount,
  renderedViewCount,
  forecast,
  missingCredential,
  isDirty,
  isSaving,
  saveError,
  onSave,
  onDiscard,
  onToggleArchived,
  isStatusPending,
  updatedAt,
}: AssetDetailRailProps) {
  const schema = assetSchemaOf(type);
  const accent = accentOf(type);
  const Icon = accent.icon;
  const isVoice = type === 'VOICE';

  return (
    <aside className="lg:sticky lg:top-6">
      <div className="border-border bg-surface elevation-sm flex flex-col gap-4 rounded-2xl border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5', accent.surface)}>
            <Icon aria-hidden className={cn('size-4', accent.text)} />
            <span className={cn('text-sm font-semibold', accent.text)}>{schema.label}</span>
          </span>
          {isArchived ? <Badge variant="secondary">Archived</Badge> : null}
          {isDirty ? <Badge variant="warning">Unsaved</Badge> : null}
        </div>

        <div className="bg-surface-raised border-border flex aspect-square items-center justify-center overflow-hidden rounded-xl border">
          {heroUrl && !isVoice ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroUrl} alt="Current reference" className="size-full object-cover" />
          ) : (
            <div className="text-foreground-subtle flex flex-col items-center gap-2 px-4 text-center">
              <ImageOff aria-hidden className="size-6" />
              <span className="text-xs">
                {isVoice ? 'Voice assets carry a sample, not an image' : 'No reference image yet'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="text-foreground truncate text-sm font-semibold">{name || 'Untitled asset'}</p>
          <p className="text-foreground-subtle truncate font-mono text-xs">@{handle}</p>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          <Row label="Fields filled" value={`${filledFieldCount}/${totalFieldCount}`} />
          {!isVoice ? (
            <>
              <Row label="Views selected" value={String(selectedViewCount)} />
              <Row label="Views rendered" value={String(renderedViewCount)} />
            </>
          ) : null}
        </dl>

        {selectedViewCount > 0 ? (
          <div className="border-border flex flex-col gap-1 border-t pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-foreground-muted text-sm">Next full render</span>
              <span className="text-foreground text-base font-semibold">
                {forecast.hasUnpricedModel ? '≥ ' : ''}${forecast.totalUsd.toFixed(2)}
              </span>
            </div>
            <p className="text-foreground-subtle text-xs">
              {selectedViewCount} image{selectedViewCount === 1 ? '' : 's'} ·{' '}
              {formatEta(forecast.etaSeconds)}
              {forecast.hasUnpricedModel ? ' · some models are unpriced, so this is a floor' : ''}
            </p>
          </div>
        ) : null}

        {missingCredential ? (
          <p className="border-warning/25 bg-warning-subtle text-warning-text flex gap-2 rounded-lg border px-3 py-2 text-xs">
            <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>{missingCredential}</span>
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button type="button" onClick={onSave} disabled={!isDirty || isSaving} fullWidth>
            <Save aria-hidden />
            {isSaving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
          </Button>
          {isDirty ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={isSaving} fullWidth>
              <RotateCcw aria-hidden />
              Discard changes
            </Button>
          ) : null}
          {saveError ? <p className="text-destructive-text text-sm">{saveError}</p> : null}
        </div>

        <div className="border-border flex flex-col gap-2 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleArchived}
            disabled={isStatusPending}
            fullWidth
          >
            {isArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {isArchived ? 'Restore to the library' : 'Archive this asset'}
          </Button>
          <p className="text-foreground-subtle text-xs">
            {isArchived
              ? 'Archived assets drop out of the grid and out of the roster the AI writes from — an @handle already written into a script still resolves to this asset.'
              : `Last saved ${new Date(updatedAt).toLocaleString()}`}
          </p>
        </div>
      </div>
    </aside>
  );
}
AssetDetailRail.displayName = 'AssetDetailRail';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="text-foreground font-medium">{value}</dd>
    </div>
  );
}

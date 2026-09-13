'use client';

import { AlertTriangle, ImageOff, Save } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { assetSchemaOf } from '@/config/asset-schema';
import { formatEta, type StageForecast } from '@/lib/cost-forecast';
import { cn } from '@/lib/cn';
import type { AssetType } from '@prisma/client';

import { accentOf } from '../asset-ui';

export interface LabSummaryRailProps {
  type: AssetType;
  name: string;
  handle: string;
  heroUrl?: string;
  filledFieldCount: number;
  totalFieldCount: number;
  selectedViewCount: number;
  doneCount: number;
  forecast: StageForecast;
  /** Missing image credential, stated once — the run would fail minutes in without it. */
  missingCredential?: string;
  onSave: () => void;
  isSaving: boolean;
  saveError?: string;
  canSave: boolean;
}

/**
 * The sticky answer to "what am I about to save, and what will the next click cost".
 *
 * The price sits here rather than inside the confirm, because in the lab the expensive click is
 * Render and the user reaches it from three different steps. Same rule as the episode room: the
 * number goes on the screen before the spend, not into the invoice after it.
 */
export function LabSummaryRail({
  type,
  name,
  handle,
  heroUrl,
  filledFieldCount,
  totalFieldCount,
  selectedViewCount,
  doneCount,
  forecast,
  missingCredential,
  onSave,
  isSaving,
  saveError,
  canSave,
}: LabSummaryRailProps) {
  const schema = assetSchemaOf(type);
  const accent = accentOf(type);
  const Icon = accent.icon;

  return (
    <aside className="lg:sticky lg:top-6">
      <div className="border-border bg-surface elevation-sm flex flex-col gap-4 rounded-2xl border p-5">
        <div className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5', accent.surface)}>
          <Icon aria-hidden className={cn('size-4', accent.text)} />
          <span className={cn('text-sm font-semibold', accent.text)}>{schema.label}</span>
        </div>

        <div className="bg-surface-raised border-border flex aspect-square items-center justify-center overflow-hidden rounded-xl border">
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroUrl} alt="Chosen reference" className="size-full object-cover" />
          ) : (
            <div className="text-foreground-subtle flex flex-col items-center gap-2 px-4 text-center">
              <ImageOff aria-hidden className="size-6" />
              <span className="text-xs">No reference image yet</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="text-foreground truncate text-sm font-semibold">{name || 'Untitled asset'}</p>
          <p className="text-foreground-subtle truncate text-xs">@{handle || '…'}</p>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          <Row label="Fields filled" value={`${filledFieldCount}/${totalFieldCount}`} />
          <Row label="Views selected" value={String(selectedViewCount)} />
          <Row label="Views rendered" value={String(doneCount)} />
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
              {selectedViewCount} image{selectedViewCount === 1 ? '' : 's'} · {formatEta(forecast.etaSeconds)}
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

        <Button type="button" onClick={onSave} disabled={!canSave || isSaving} fullWidth>
          <Save aria-hidden />
          {isSaving ? 'Saving…' : 'Save to library'}
        </Button>
        {saveError ? <p className="text-destructive-text text-sm">{saveError}</p> : null}
        <p className="text-foreground-subtle text-xs">
          Saving keeps the whole sheet and the base prompt, so this asset can be re-rendered later
          without starting over.
        </p>
      </div>
    </aside>
  );
}
LabSummaryRail.displayName = 'LabSummaryRail';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="text-foreground font-medium">{value}</dd>
    </div>
  );
}

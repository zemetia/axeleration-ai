'use client';

import { ImageOff, Mic2 } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import type { AssetVO } from '@/types/value-objects';

import { accentOf, highlightsOf } from './asset-ui';

export interface AssetCardProps {
  asset: AssetVO;
  projectId: string;
}

/**
 * The image *is* the asset for most types, so the card is picture-first: a 4:5 reference frame,
 * the handle and name below it, and the two or three attributes that identify this asset at a
 * glance (`highlightKeys` in the type schema). Everything else lives on the asset's own page,
 * which this card is a real link to — an asset is worth a URL that can be shared and bookmarked.
 */
export function AssetCard({ asset, projectId }: AssetCardProps) {
  const accent = accentOf(asset.type);
  const Icon = accent.icon;
  const isVoice = asset.type === 'VOICE';
  const highlights = highlightsOf(asset).slice(0, 3);

  return (
    <Link
      href={`/projects/${projectId}/assets/${asset.id}`}
      className={cn(
        'group border-border bg-card flex flex-col overflow-hidden rounded-xl border text-left',
        'elevation-sm hover:border-border-strong hover:elevation-lg transition-all duration-150 hover:-translate-y-0.5',
        'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        asset.status === 'ARCHIVED' && 'opacity-60',
      )}
    >
      <div className={cn('relative aspect-[4/5] w-full overflow-hidden', accent.surface)}>
        {asset.refUrl && !isVoice ? (
          // Local storage serves arbitrary user uploads through /media — next/image would need
          // every future host allow-listed, so a plain img is deliberate.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.refUrl}
            alt={asset.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <Icon aria-hidden className={cn('size-9', accent.text)} strokeWidth={1.25} />
            <span className={cn('text-[0.7rem] font-medium tracking-wide uppercase', accent.text)}>
              {isVoice ? (asset.refUrl ? 'Audio sample' : 'No sample') : 'No reference'}
            </span>
          </div>
        )}

        <span
          className={cn(
            'absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-1',
            'bg-surface/90 text-[0.7rem] font-semibold backdrop-blur-sm',
            accent.text,
          )}
        >
          <Icon aria-hidden className="size-3" />
          {asset.typeLabel}
        </span>

        {asset.status === 'ARCHIVED' ? (
          <span className="bg-surface/90 text-foreground-muted absolute top-2 right-2 rounded-full px-2 py-1 text-[0.7rem] font-semibold backdrop-blur-sm">
            Archived
          </span>
        ) : null}

        {!asset.refUrl ? (
          <span className="bg-surface/90 text-warning-foreground absolute right-2 bottom-2 rounded-full p-1.5 backdrop-blur-sm">
            {isVoice ? (
              <Mic2 aria-hidden className="size-3" />
            ) : (
              <ImageOff aria-hidden className="size-3" />
            )}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-primary-text truncate font-mono text-xs">@{asset.handle}</span>
          <span className="text-foreground truncate text-sm font-semibold">{asset.name}</span>
        </div>

        {highlights.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {highlights.map((item) => (
              <span
                key={item.key}
                title={`${item.label}: ${item.value}`}
                className="bg-surface-raised text-foreground-muted ring-border max-w-full truncate rounded-md px-1.5 py-0.5 text-[0.7rem] ring-1 ring-inset"
              >
                {item.value}
              </span>
            ))}
          </div>
        ) : asset.description ? (
          <p className="text-foreground-muted line-clamp-2 text-xs leading-relaxed">
            {asset.description}
          </p>
        ) : (
          <p className="text-foreground-subtle text-xs italic">No details yet</p>
        )}
      </div>
    </Link>
  );
}
AssetCard.displayName = 'AssetCard';

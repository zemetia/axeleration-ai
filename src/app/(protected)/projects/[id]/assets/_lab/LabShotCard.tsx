'use client';

import { AlertTriangle, Anchor, Check, ExternalLink, RefreshCw, Star } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { AssetView } from '@/config/asset-views';
import { cn } from '@/lib/cn';

import { CopyButton } from '../CopyButton';
import type { ShotState } from './useLabRun';

export interface LabShotCardProps {
  view: AssetView;
  state: ShotState | undefined;
  isHero: boolean;
  isAnchorSource: boolean;
  onRetry: () => void;
  onSetHero: () => void;
  isBusy: boolean;
}

const ASPECT_CLASS: Record<AssetView['aspect'], string> = {
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  '9:16': 'aspect-[9/16]',
};

/**
 * One angle on the sheet.
 *
 * The frame keeps the view's own aspect ratio in every state — queued, running, failed, done — so
 * the sheet does not reflow as images land. A failed shot keeps its slot and its error text rather
 * than disappearing: it is one retry, not a lost run.
 */
export function LabShotCard({
  view,
  state,
  isHero,
  isAnchorSource,
  onRetry,
  onSetHero,
  isBusy,
}: LabShotCardProps) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const status = state?.status ?? 'idle';

  return (
    <figure
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border transition-colors',
        isHero ? 'border-primary elevation-md' : 'border-border bg-surface',
      )}
    >
      <div className={cn('bg-surface-raised relative flex items-center justify-center', ASPECT_CLASS[view.aspect])}>
        {status === 'done' && state?.shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.shot.url} alt={view.label} className="size-full object-cover" />
        ) : status === 'running' ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Spinner />
            <span className="text-foreground-muted text-xs">
              {state?.progress
                ? `Panel ${Math.min(state.progress.done + 1, state.progress.total)} of ${state.progress.total}…`
                : 'Rendering…'}
            </span>
            {state?.progress ? (
              <span className="text-foreground-subtle text-[0.7rem]">
                Each angle is rendered on its own, then tiled into the sheet.
              </span>
            ) : null}
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <AlertTriangle aria-hidden className="text-destructive-text size-6" />
            <span className="text-destructive-text text-xs">{state?.error}</span>
          </div>
        ) : (
          <span className="text-foreground-subtle text-xs">
            {status === 'queued' ? 'Queued' : 'Not generated'}
          </span>
        )}

        {isHero ? (
          <span className="bg-primary text-primary-foreground absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
            <Star aria-hidden className="size-3" />
            Reference
          </span>
        ) : null}
      </div>

      <figcaption className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-sm font-semibold">{view.label}</span>
          {isAnchorSource ? (
            <Badge variant="soft">
              <Anchor aria-hidden />
              Anchor
            </Badge>
          ) : null}
          {state?.shot?.fromReference ? <Badge variant="outline">from reference</Badge> : null}
          {typeof state?.shot?.costUsd === 'number' ? (
            <Badge variant="secondary">${state.shot.costUsd.toFixed(3)}</Badge>
          ) : null}
        </div>

        <p className="text-foreground-muted text-xs leading-relaxed">{view.purpose}</p>

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="ghost" onClick={onRetry} disabled={isBusy}>
            <RefreshCw aria-hidden />
            {status === 'done' ? 'Redo' : 'Generate'}
          </Button>
          {status === 'done' && state?.shot ? (
            <>
              <Button
                type="button"
                size="sm"
                variant={isHero ? 'outline' : 'ghost'}
                onClick={onSetHero}
                disabled={isHero}
              >
                {isHero ? <Check aria-hidden /> : <Star aria-hidden />}
                {isHero ? 'Reference' : 'Use as reference'}
              </Button>
              <Button type="button" size="sm" variant="ghost" asChild>
                <a href={state.shot.url} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Full size
                </a>
              </Button>
            </>
          ) : null}
        </div>

        {state?.shot ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsPromptOpen((open) => !open)}
                className="text-foreground-subtle hover:text-foreground w-fit text-xs underline-offset-2 hover:underline"
              >
                {isPromptOpen ? 'Hide prompt' : 'Show prompt'}
              </button>
              <CopyButton value={state.shot.prompt} label="Copy" />
            </div>
            {isPromptOpen ? (
              <pre className="bg-surface-raised text-foreground-muted max-h-40 overflow-auto rounded-lg p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
                {state.shot.prompt}
              </pre>
            ) : null}
          </div>
        ) : null}
      </figcaption>
    </figure>
  );
}
LabShotCard.displayName = 'LabShotCard';

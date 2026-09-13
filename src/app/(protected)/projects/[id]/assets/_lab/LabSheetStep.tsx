'use client';

import { Camera, Mic2, Play, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Progress } from '@/components/ui/Progress';
import { viewPlanOf } from '@/config/asset-views';
import type { AssetType } from '@prisma/client';

import { LabShotCard } from './LabShotCard';
import type { ShotStates } from './useLabRun';

export interface LabSheetStepProps {
  type: AssetType;
  selectedViewIds: string[];
  shots: ShotStates;
  isRunning: boolean;
  heroUrl?: string;
  hasUploadedReference: boolean;
  onRun: () => void;
  onRetry: (viewId: string) => void;
  onSetHero: (url: string) => void;
  canRun: boolean;
  blockedReason?: string;
}

/**
 * The contact sheet.
 *
 * Progress is counted in finished shots against selected ones, not a spinner: a sheet takes minutes
 * and the user is entitled to know how much of it is paid for so far. The same rule the episode
 * room learned — a grey skeleton is not a status.
 */
export function LabSheetStep({
  type,
  selectedViewIds,
  shots,
  isRunning,
  heroUrl,
  hasUploadedReference,
  onRun,
  onRetry,
  onSetHero,
  canRun,
  blockedReason,
}: LabSheetStepProps) {
  const plan = viewPlanOf(type);
  const selectedViews = plan.views.filter((view) => selectedViewIds.includes(view.id));
  const doneCount = selectedViewIds.filter((id) => shots[id]?.status === 'done').length;
  const hasAnyShot = Object.values(shots).some((state) => state.status !== 'idle');

  if (plan.views.length === 0) {
    return (
      <EmptyState
        icon={Mic2}
        title="Nothing to render"
        description="Voice assets carry a reference sample and delivery direction instead of images. Attach the sample in the brief step, then save."
      />
    );
  }

  if (selectedViews.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="No views selected"
        description="Pick at least one angle in the view plan — that is what the lab renders."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-surface flex flex-wrap items-center gap-4 rounded-xl border p-4">
        <div className="min-w-[12rem] flex-1">
          <p className="text-foreground text-sm font-semibold">
            {doneCount} of {selectedViews.length} views rendered
          </p>
          <Progress value={(doneCount / selectedViews.length) * 100} className="mt-2" />
        </div>
        <Button type="button" onClick={onRun} disabled={!canRun || isRunning}>
          {hasAnyShot ? <RefreshCw aria-hidden /> : <Play aria-hidden />}
          {isRunning ? 'Rendering…' : hasAnyShot ? 'Render all again' : `Render ${selectedViews.length} views`}
        </Button>
      </div>

      {blockedReason ? (
        <p className="border-warning/25 bg-warning-subtle text-warning-text rounded-lg border px-3 py-2 text-sm">
          {blockedReason}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {selectedViews.map((view) => {
          const state = shots[view.id];
          return (
            <LabShotCard
              key={view.id}
              view={view}
              state={state}
              isHero={Boolean(state?.shot && state.shot.url === heroUrl)}
              isAnchorSource={Boolean(view.isAnchor) && !hasUploadedReference}
              isBusy={isRunning}
              onRetry={() => onRetry(view.id)}
              onSetHero={() => {
                if (state?.shot) onSetHero(state.shot.url);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
LabSheetStep.displayName = 'LabSheetStep';

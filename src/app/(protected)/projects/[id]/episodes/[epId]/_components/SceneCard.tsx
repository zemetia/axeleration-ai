'use client';

import { Film, Pencil, Sparkles, VideoOff } from 'lucide-react';
import { useState } from 'react';

import { StatusChip } from '@/components/shared/StatusChip';
import { Button } from '@/components/ui/Button';
import { aiConfig } from '@/config/ai';
import { useEpisodeForecast, useRegenerateScene, useUpdateScene } from '@/hooks/queries';
import { sceneHeadline } from '@/lib/scene-prompt';
import type { SceneVO } from '@/types/value-objects';

import { RunDialog } from './RunDialog';
import { RunStatus } from './RunStatus';
import { currencyFormat } from './rooms';
import { SceneDetailDialog } from './SceneDetailDialog';
import { SceneEditDialog } from './SceneEditDialog';
import { draftToInput, sceneToDraft, type SceneSpecDraft } from './SceneSpecForm';

export interface SceneCardProps {
  /** Which project's roster the beat's `@handle` mentions link into. */
  projectId: string;
  episodeId: string;
  scene: SceneVO;
}

export function SceneCard({ projectId, episodeId, scene }: SceneCardProps) {
  const updateScene = useUpdateScene(episodeId);
  const regenerateScene = useRegenerateScene(episodeId);
  const { data: forecast } = useEpisodeForecast(episodeId);

  const [openDialog, setOpenDialog] = useState<'detail' | 'edit' | null>(null);
  const [draft, setDraft] = useState<SceneSpecDraft>(() => sceneToDraft(scene));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isRunOpen, setIsRunOpen] = useState(false);

  const isSaving = updateScene.isPending && updateScene.variables?.sceneIndex === scene.index;
  const isRegenerating =
    (regenerateScene.isPending && regenerateScene.variables?.sceneIndex === scene.index) ||
    scene.status === 'GENERATING';
  const attemptsLeft = aiConfig.limits.maxRegenPerStage - scene.attempt;
  const isRegenLimitReached = attemptsLeft <= 0;
  const sceneForecast = forecast?.scenes[String(scene.index)];
  const shotCount = scene.shots.length;

  function startEditing() {
    setDraft(sceneToDraft(scene));
    setError(null);
    setOpenDialog('edit');
  }

  function save() {
    updateScene.mutate(
      { sceneIndex: scene.index, patch: draftToInput(draft) },
      // Only leave the editor when the beat actually came back. A refused write returns a message
      // and no beat; closing on that threw away what was typed and showed the old text as if it
      // had been saved.
      {
        onSuccess: (result) => {
          if (result.scene) return setOpenDialog(null);
          setError(result.message ?? 'Could not save this beat.');
        },
      },
    );
  }

  return (
    <article className="elevation-sm border-border bg-surface flex flex-col overflow-hidden rounded-2xl border">
      {scene.status === 'GENERATING' ? (
        <div className="p-4 pb-0">
          <RunStatus
            label={`Generating scene ${scene.index}`}
            startedAt={scene.startedAt}
            etaSeconds={sceneForecast?.etaSeconds}
          />
        </div>
      ) : (
        <div className="border-border bg-surface-raised relative flex aspect-video w-full items-center justify-center overflow-hidden border-b">
          {scene.videoUrl ? (
            <video controls src={scene.videoUrl} className="size-full object-cover" />
          ) : (
            <span className="text-foreground-subtle flex flex-col items-center gap-1.5 text-xs">
              <VideoOff className="size-5" aria-hidden="true" />
              Not generated yet
            </span>
          )}
          <span className="bg-surface/90 text-foreground absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur">
            <Film className="size-3" aria-hidden="true" />
            Scene {scene.index}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={scene.status} />
            {scene.attempt > 0 ? (
              <span className="text-foreground-subtle text-xs">attempt {scene.attempt + 1}</span>
            ) : null}
          </div>
          <span className="text-foreground-muted text-xs tabular-nums">
            {scene.durationSeconds}s
            {scene.costEstimate === null ? '' : ` · ${currencyFormat.format(scene.costEstimate)}`}
          </span>
        </header>

        {scene.status === 'FAILED' ? (
          <p className="bg-destructive-subtle text-destructive-text rounded-lg px-3 py-2 text-xs leading-relaxed">
            {scene.error ?? 'Generation failed.'}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          {/* A summary, not the whole beat — the card's job is the clip above it. Clicking opens
              the full block view, which is also where the prompt that was sent lives. */}
          <button
            type="button"
            onClick={() => setOpenDialog('detail')}
            className="focus-visible:ring-ring -m-1 flex cursor-pointer flex-col gap-1.5 rounded-lg p-1 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="text-foreground text-sm leading-relaxed">
              {sceneHeadline(scene) || 'Empty beat.'}
            </span>
            <span className="text-foreground-subtle text-xs">
              {shotCount} {shotCount === 1 ? 'shot' : 'shots'}
              {scene.dialogue.length > 0
                ? ` · ${scene.dialogue.length} spoken ${scene.dialogue.length === 1 ? 'line' : 'lines'}`
                : ' · no dialogue'}
              {' · '}
              <span className="underline decoration-dotted underline-offset-2">See details</span>
            </span>
          </button>

          <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              size="sm"
              disabled={isRegenerating || isRegenLimitReached}
              onClick={() => setIsRunOpen(true)}
            >
              <Sparkles aria-hidden="true" />
              {isRegenerating ? 'Generating…' : scene.videoUrl ? 'Regenerate' : 'Generate'}
            </Button>
            <Button size="sm" variant="ghost" disabled={isRegenerating} onClick={startEditing}>
              <Pencil aria-hidden="true" />
              Edit beat
            </Button>
            {isRegenLimitReached ? (
              <span className="text-foreground-subtle text-xs">
                Limit reached ({aiConfig.limits.maxRegenPerStage} runs)
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <SceneDetailDialog
        projectId={projectId}
        scene={scene}
        isOpen={openDialog === 'detail'}
        onOpenChange={(open) => setOpenDialog(open ? 'detail' : null)}
        prompt={scene.prompt}
        onEdit={startEditing}
      />

      <SceneEditDialog
        projectId={projectId}
        title={`Edit scene ${scene.index}`}
        description="Saving only rewrites the beat — regenerate the scene to see it on screen."
        isOpen={openDialog === 'edit'}
        onOpenChange={(open) => setOpenDialog(open ? 'edit' : null)}
        value={draft}
        onChange={setDraft}
        error={error}
        isPending={isSaving}
        confirmLabel="Save beat"
        pendingLabel="Saving…"
        onConfirm={save}
      />

      <RunDialog
        isOpen={isRunOpen}
        onOpenChange={setIsRunOpen}
        title={
          scene.videoUrl ? `Regenerate scene ${scene.index}?` : `Generate scene ${scene.index}?`
        }
        description={
          scene.videoUrl
            ? `Replaces this clip only — every other scene is left alone. ${attemptsLeft} of ${aiConfig.limits.maxRegenPerStage} runs left for this beat.`
            : 'Generates this clip from the beat as written. Other scenes are untouched.'
        }
        {...(sceneForecast ? { forecast: sceneForecast } : {})}
        note={{ value: note, onChange: setNote, placeholder: 'e.g. "wider shot, no dialogue"' }}
        confirmLabel={scene.videoUrl ? 'Regenerate scene' : 'Generate scene'}
        pendingLabel="Starting…"
        isPending={regenerateScene.isPending}
        isDanger={Boolean(scene.videoUrl)}
        onConfirm={() =>
          regenerateScene.mutate(
            { sceneIndex: scene.index, note: note || undefined },
            {
              onSettled: () => {
                setNote('');
                setIsRunOpen(false);
              },
            },
          )
        }
      />
    </article>
  );
}
SceneCard.displayName = 'SceneCard';

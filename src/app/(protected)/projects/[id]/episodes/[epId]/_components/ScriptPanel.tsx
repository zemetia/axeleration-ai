'use client';

import { ArrowRight, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { MentionText } from '@/components/shared/MentionText';
import { Button, buttonVariants } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { aiConfig } from '@/config/ai';
import {
  useAddScriptScene,
  useDeleteScriptScene,
  useEpisodeForecast,
  useRefineScript,
  useRegenerateStage,
  useUpdateScene,
  useUpdateScript,
} from '@/hooks/queries';
import { blockedReason } from '@/lib/provider-readiness';
import { sceneHeadline, shotWindows } from '@/lib/scene-prompt';
import { readSceneSpecs, type SceneSpec } from '@/lib/scene-spec';
import type { EpisodeStageVO } from '@/types/value-objects';

import { RunDialog } from './RunDialog';
import { SceneDetailDialog } from './SceneDetailDialog';
import { SceneEditDialog } from './SceneEditDialog';
import {
  draftToInput,
  emptySceneDraft,
  isDraftEmpty,
  sceneToDraft,
  type SceneSpecDraft,
} from './SceneSpecForm';
import { StagePanel } from './StagePanel';

export interface ScriptPanelProps {
  projectId: string;
  episodeId: string;
}


function LoglineRow({ episodeId, logline }: { episodeId: string; logline: string }) {
  const updateScript = useUpdateScript(episodeId);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(logline);

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2">
        <TextAreaField
          label="Logline"
          value={draft}
          onChange={setDraft}
          rows={2}
          placeholder="One sentence: what is this episode about?"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={updateScript.isPending}
            onClick={() =>
              updateScript.mutate({ logline: draft }, { onSuccess: () => setIsEditing(false) })
            }
          >
            {updateScript.isPending ? 'Saving…' : 'Save logline'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={updateScript.isPending}
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-raised flex flex-wrap items-start justify-between gap-2 rounded-xl px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-eyebrow">Logline</span>
        <p className="text-foreground text-sm leading-relaxed">
          {logline || <span className="text-foreground-subtle">No logline yet.</span>}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setDraft(logline);
          setIsEditing(true);
        }}
      >
        <Pencil aria-hidden="true" />
        {logline ? 'Edit' : 'Add'}
      </Button>
    </div>
  );
}

/**
 * One beat in the breakdown, summarised. Everything that opens from it is a modal: the row is a
 * line in a list of twelve, and neither reading a beat in full nor rewriting it fits in one.
 *
 * Clicking the row opens the detail; Edit skips straight past it to the editor, since a user who
 * already knows what they want to change should not have to read the beat first. Both dialogs are
 * mounted here rather than in the panel because they are about *this* beat — but delete is not: it
 * renumbers the beats after it, so a row keyed by index is reused for a different beat, and per-row
 * state would survive that swap and delete the wrong one. That confirmation stays in the panel.
 */
function SceneRow({
  projectId,
  episodeId,
  scene,
  isDeleting,
  onRequestDelete,
}: {
  projectId: string;
  episodeId: string;
  scene: SceneSpec;
  isDeleting: boolean;
  onRequestDelete: (index: number) => void;
}) {
  const updateScene = useUpdateScene(episodeId);

  const [openDialog, setOpenDialog] = useState<'detail' | 'edit' | null>(null);
  const [draft, setDraft] = useState<SceneSpecDraft>(() => sceneToDraft(scene));
  const [error, setError] = useState<string | null>(null);

  const isSaving = updateScene.isPending && updateScene.variables?.sceneIndex === scene.index;

  function startEditing() {
    setDraft(sceneToDraft(scene));
    setError(null);
    setOpenDialog('edit');
  }

  function save() {
    updateScene.mutate(
      { sceneIndex: scene.index, patch: draftToInput(draft) },
      // Stay open when the write was refused — see the same guard in `SceneCard`.
      {
        onSuccess: (result) => {
          if (result.scene) return setOpenDialog(null);
          setError(result.message ?? 'Could not save this beat.');
        },
      },
    );
  }

  const shotCount = scene.shots.length;

  // The whole row is the affordance — the buttons on the right are the discoverable version of the
  // same thing. It is an overlay rather than a button wrapped around the text because the beat
  // renders `@handle` links: an `<a>` inside a `<button>` is invalid HTML, and browsers resolve it
  // by dropping the link. The overlay takes the clicks the content lets through
  // (`pointer-events-none`), and the mentions and buttons opt back in with `pointer-events-auto`.
  return (
    <li className="group border-border bg-surface hover:border-border-strong focus-within:border-border-strong relative rounded-xl border transition-colors">
      <button
        type="button"
        onClick={() => setOpenDialog('detail')}
        aria-label={`Open scene ${scene.index}`}
        className="focus-visible:ring-ring absolute inset-0 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      />

      <div className="pointer-events-none relative flex items-start gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span className="bg-surface-raised text-foreground-muted flex size-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums">
              {scene.index}
            </span>
            <span className="text-foreground-subtle text-xs">
              {scene.durationSeconds}s · {shotCount} {shotCount === 1 ? 'shot' : 'shots'}
            </span>
          </span>

          {/* The structural view of a beat: where it is, then the cut inside it. */}
          <p className="text-foreground text-sm leading-relaxed">
            {sceneHeadline(scene) ? (
              <MentionText text={sceneHeadline(scene)} projectId={projectId} />
            ) : (
              'Empty beat.'
            )}
          </p>
          {shotCount > 0 ? (
            <ol className="border-border flex flex-col gap-0.5 border-l-2 pl-3">
              {shotWindows(scene.shots).map((window, position) => (
                <li key={position} className="text-foreground-muted text-xs leading-relaxed">
                  <span className="text-foreground-subtle tabular-nums">
                    {window.startSeconds}-{window.endSeconds}s
                  </span>{' '}
                  <MentionText
                    text={
                      [scene.shots[position]?.camera, scene.shots[position]?.action]
                        .filter(Boolean)
                        .join(' — ') || 'Not written yet'
                    }
                    projectId={projectId}
                  />
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-1">
          <Button size="xs" variant="ghost" onClick={startEditing}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={isDeleting}
            onClick={() => onRequestDelete(scene.index)}
            className="hover:text-destructive-text"
          >
            <Trash2 aria-hidden="true" />
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>

      <SceneDetailDialog
        projectId={projectId}
        scene={scene}
        isOpen={openDialog === 'detail'}
        onOpenChange={(open) => setOpenDialog(open ? 'detail' : null)}
        onEdit={startEditing}
        onDelete={() => {
          setOpenDialog(null);
          onRequestDelete(scene.index);
        }}
        isDeleting={isDeleting}
      />

      <SceneEditDialog
        projectId={projectId}
        title={`Edit scene ${scene.index}`}
        description="Saving only rewrites the beat — generate the scene to see it on screen."
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
    </li>
  );
}

function AddSceneForm({
  projectId,
  episodeId,
  isOpen,
  onOpenChange,
}: {
  projectId: string;
  episodeId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addScene = useAddScriptScene(episodeId);
  const [draft, setDraft] = useState<SceneSpecDraft>(emptySceneDraft);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setDraft(emptySceneDraft());
    setError(null);
    onOpenChange(false);
  }

  function save() {
    addScene.mutate(draftToInput(draft), {
      // The action reports failures as a message rather than throwing, so success is only
      // success when the message is absent.
      onSuccess: (result) => (result.message ? setError(result.message) : close()),
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => onOpenChange(true)}>
        <Plus aria-hidden="true" />
        Add scene
      </Button>

      <SceneEditDialog
        projectId={projectId}
        title="Add a scene"
        description="One scene is one generated clip — the shots below are the cuts inside it."
        isOpen={isOpen}
        onOpenChange={(open) => (open ? onOpenChange(true) : close())}
        value={draft}
        onChange={setDraft}
        error={error}
        isPending={addScene.isPending}
        isConfirmDisabled={isDraftEmpty(draft)}
        confirmLabel="Add scene"
        pendingLabel="Adding…"
        onConfirm={save}
      />
    </>
  );
}

/**
 * The scene breakdown — structure lives here (logline, add, delete, reorder-by-index), while the
 * Scenes room stays the place with video previews and per-scene regeneration. Both edit the same
 * SCRIPT stage output, so a beat written here shows up there as a card ready to generate.
 */
export function ScriptPanel({ projectId, episodeId }: ScriptPanelProps) {
  const deleteScene = useDeleteScriptScene(episodeId);
  const regenerateStage = useRegenerateStage(episodeId);
  const refineScript = useRefineScript(episodeId);
  const { data: forecast } = useEpisodeForecast(episodeId);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [openDialog, setOpenDialog] = useState<'recreate' | 'refine' | null>(null);
  const [recreateNote, setRecreateNote] = useState('');
  const [refineNote, setRefineNote] = useState('');

  const scriptForecast = forecast?.stages.SCRIPT;
  const scriptBlocked = blockedReason(forecast?.readiness.stages.SCRIPT);

  return (
    <StagePanel
      episodeId={episodeId}
      kind="SCRIPT"
      upstreamLabel="the idea"
      // The built-in Regenerate is replaced by "Recreate" below — same underlying run, a name that
      // says what it actually does to a beat list the user has been editing by hand ("start over"
      // reads clearer here than "regenerate" once beats have been added or deleted one at a time).
      hideRegenerate
      emptyAction={() =>
        isAdding ? null : (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus aria-hidden="true" />
            Write the script yourself
          </Button>
        )
      }
      actions={(stage: EpisodeStageVO) => {
        const scenes = readSceneSpecs(stage.output);
        const isCapped = stage.attempt >= aiConfig.limits.maxRegenPerStage;
        const attemptsLeft = aiConfig.limits.maxRegenPerStage - stage.attempt;

        return (
          <>
            <Button
              size="sm"
              variant="outline"
              isLoading={refineScript.isPending}
              disabled={
                refineScript.isPending || isCapped || scenes.length === 0 || Boolean(scriptBlocked)
              }
              title={scriptBlocked ?? (scenes.length === 0 ? 'Nothing to refine yet' : undefined)}
              onClick={() => setOpenDialog('refine')}
            >
              {refineScript.isPending ? null : <Sparkles aria-hidden="true" />}
              {refineScript.isPending ? 'Refining…' : 'Refine'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              isLoading={regenerateStage.isPending}
              disabled={regenerateStage.isPending || isCapped || Boolean(scriptBlocked)}
              title={scriptBlocked ?? undefined}
              onClick={() => setOpenDialog('recreate')}
            >
              {regenerateStage.isPending ? null : <RotateCcw aria-hidden="true" />}
              {regenerateStage.isPending ? 'Recreating…' : 'Recreate'}
            </Button>

            <RunDialog
              isOpen={openDialog === 'refine'}
              onOpenChange={(open) => setOpenDialog(open ? 'refine' : null)}
              title="Refine the scene breakdown?"
              description="Improves the beats that are there — the count, order and dialogue stay as they are, and the note below is what changes. To throw everything away and start over, use Recreate instead."
              {...(scriptForecast ? { forecast: scriptForecast } : {})}
              note={{
                value: refineNote,
                onChange: setRefineNote,
                placeholder: 'e.g. "add more tension in scene 3", "make the dialogue punchier"',
              }}
              confirmLabel="Refine"
              pendingLabel="Refining…"
              isPending={refineScript.isPending}
              onConfirm={() =>
                refineScript.mutate(refineNote || undefined, {
                  onSettled: () => {
                    setRefineNote('');
                    setOpenDialog(null);
                  },
                })
              }
            />

            <RunDialog
              isOpen={openDialog === 'recreate'}
              onOpenChange={(open) => setOpenDialog(open ? 'recreate' : null)}
              title="Recreate every scene?"
              description={`Deletes every scene in the breakdown — including any you added or edited by hand — and writes a brand new one from scratch. This cannot be undone. ${attemptsLeft} of ${aiConfig.limits.maxRegenPerStage} runs left.`}
              {...(scriptForecast ? { forecast: scriptForecast } : {})}
              note={{
                value: recreateNote,
                onChange: setRecreateNote,
                placeholder: 'e.g. "make it darker", "cut the narration"',
              }}
              confirmLabel="Recreate"
              pendingLabel="Recreating…"
              isPending={regenerateStage.isPending}
              isDanger
              onConfirm={() =>
                regenerateStage.mutate(
                  { stage: 'SCRIPT', note: recreateNote || undefined },
                  {
                    onSettled: () => {
                      setRecreateNote('');
                      setOpenDialog(null);
                    },
                  },
                )
              }
            />
          </>
        );
      }}
    >
      {(stage: EpisodeStageVO) => {
        const logline = (stage.output ?? {})['logline'];
        const scenes = readSceneSpecs(stage.output);
        const totalSeconds = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);

        return (
          <div className="flex flex-col gap-4">
            <LoglineRow episodeId={episodeId} logline={typeof logline === 'string' ? logline : ''} />

            {scenes.length > 0 ? (
              <>
                <p className="text-eyebrow">
                  {scenes.length} scenes · {totalSeconds}s total
                </p>
                <ol className="flex flex-col gap-2">
                  {scenes.map((scene) => (
                    <SceneRow
                      key={scene.index}
                      projectId={projectId}
                      episodeId={episodeId}
                      scene={scene}
                      isDeleting={deleteScene.isPending && deleteScene.variables === scene.index}
                      onRequestDelete={setDeletingIndex}
                    />
                  ))}
                </ol>
              </>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <AddSceneForm
                projectId={projectId}
                episodeId={episodeId}
                isOpen={isAdding}
                onOpenChange={setIsAdding}
              />

              {scenes.length > 0 ? (
                <Link
                  href={`/projects/${projectId}/episodes/${episodeId}/scenes`}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  Open the Scenes room
                  <ArrowRight aria-hidden="true" />
                </Link>
              ) : null}
            </div>

            <RunDialog
              isOpen={deletingIndex !== null}
              onOpenChange={(open) => setDeletingIndex(open ? deletingIndex : null)}
              title={`Delete scene ${deletingIndex ?? ''}?`}
              description={
                'Removes this beat from the breakdown, along with any clip already generated for it. This cannot be undone.'
              }
              confirmLabel="Delete beat"
              pendingLabel="Deleting…"
              isPending={deleteScene.isPending}
              isDanger
              onConfirm={() => {
                if (deletingIndex === null) return;
                deleteScene.mutate(deletingIndex, { onSettled: () => setDeletingIndex(null) });
              }}
            />
          </div>
        );
      }}
    </StagePanel>
  );
}
ScriptPanel.displayName = 'ScriptPanel';

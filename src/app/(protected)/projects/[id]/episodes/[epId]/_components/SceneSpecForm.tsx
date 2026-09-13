'use client';

import { Plus, Trash2 } from 'lucide-react';

import { MentionText } from '@/components/shared/MentionText';
import { Button } from '@/components/ui/Button';
import { NumberInputField } from '@/components/ui/NumberInputField';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { TextInputField } from '@/components/ui/TextInputField';
import {
  formatScenePrompt,
  sceneTotalSeconds,
  shotWindows,
  type ScenePromptInput,
} from '@/lib/scene-prompt';
import type { SceneShotVO, SceneSpecInput } from '@/types/value-objects';

import { dialogueToText, textToDialogue } from './dialogue-text';

/**
 * The beat editor — one form per generation, laid out as the blocks of the prompt it produces.
 *
 * The form *is* the prompt: every field is one block of `formatScenePrompt`, in the order they
 * render, and the preview underneath is that exact function run over what has been typed. Nothing
 * is described twice in two vocabularies, so there is no gap between "what I wrote" and "what was
 * sent" for a user to have to learn.
 *
 * Shot durations are the only timing input. A scene has no duration field because it has no
 * duration of its own — it is the sum of its shots, which is also what puts each shot in its
 * `(X-Ys)` window, so a duration typed anywhere else could only contradict them.
 *
 * Dialogue is the one place the form deliberately does *not* mirror the prompt's layout: the prompt
 * gathers every line into one `[DIALOGUE]` block tagged with the shot it belongs to, but the form
 * puts each line in the shot it is spoken over. Written as one list, the shot number is a
 * cross-reference the user has to maintain by hand — and it goes stale the moment a shot is
 * inserted, removed or re-timed above it. Written inside the shot, it cannot be wrong.
 */

export const DEFAULT_SHOT_SECONDS = 4;

/** A shot as it is edited: the stored fields plus the dialogue spoken over it, held as text. */
export interface SceneShotDraft extends SceneShotVO {
  /** One line per row, `Speaker (delivery): line` — see `dialogue-text.ts`. */
  dialogueText: string;
}

export interface SceneSpecDraft {
  style: string;
  setting: string;
  shots: SceneShotDraft[];
  lighting: string;
  audio: string;
  negative: string;
}

function emptyShot(): SceneShotDraft {
  return { durationSeconds: DEFAULT_SHOT_SECONDS, camera: '', action: '', dialogueText: '' };
}

export function emptySceneDraft(): SceneSpecDraft {
  return { style: '', setting: '', shots: [emptyShot()], lighting: '', audio: '', negative: '' };
}

/** Takes any stored beat — a `SceneVO` from the Scenes room, a `SceneSpec` from the stage output. */
export function sceneToDraft(scene: ScenePromptInput): SceneSpecDraft {
  // A beat saved before the block format existed arrives with no shots; it still needs one row to
  // be editable at all.
  const shots = scene.shots.length > 0 ? scene.shots : [emptyShot()];

  return {
    style: scene.style,
    setting: scene.setting,
    shots: shots.map((shot, position) => ({
      ...shot,
      // Clamped, not filtered: a line pinned past the end of the shot list (a model's answer, or a
      // beat whose shots were cut down) lands on the last shot rather than disappearing from the
      // editor — losing dialogue silently is the one outcome worse than putting it in the wrong place.
      dialogueText: dialogueToText(
        scene.dialogue.filter((line) => Math.min(Math.max(line.shot, 1), shots.length) === position + 1),
      ),
    })),
    lighting: scene.lighting,
    audio: scene.audio,
    negative: scene.negative,
  };
}

export function draftToInput(draft: SceneSpecDraft): SceneSpecInput {
  return {
    style: draft.style.trim(),
    setting: draft.setting.trim(),
    shots: draft.shots.map((shot) => ({
      durationSeconds: shot.durationSeconds,
      camera: shot.camera.trim(),
      action: shot.action.trim(),
    })),
    lighting: draft.lighting.trim(),
    audio: draft.audio.trim(),
    // Flattened back into one scene-level list, tagged by the row it was typed in — which is what
    // makes the shot number correct by construction rather than by the user remembering it.
    dialogue: draft.shots.flatMap((shot, position) => textToDialogue(shot.dialogueText, position + 1)),
    negative: draft.negative.trim(),
  };
}

/** What the beat renders to right now — the same call the generation path makes. */
export function draftToPrompt(draft: SceneSpecDraft): string {
  return formatScenePrompt(draftToInput(draft));
}

/** A beat with nothing in any block is a blank card; the shot rows alone do not make it writable. */
export function isDraftEmpty(draft: SceneSpecDraft): boolean {
  const input = draftToInput(draft);
  return (
    !input.style &&
    !input.setting &&
    !input.lighting &&
    !input.audio &&
    !input.negative &&
    input.dialogue.length === 0 &&
    input.shots.every((shot) => !shot.camera && !shot.action)
  );
}

function ShotRows({
  shots,
  onChange,
}: {
  shots: SceneShotDraft[];
  onChange: (shots: SceneShotDraft[]) => void;
}) {
  const windows = shotWindows(shots);

  function patch(position: number, patchValue: Partial<SceneShotDraft>) {
    onChange(shots.map((shot, index) => (index === position ? { ...shot, ...patchValue } : shot)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-eyebrow">Shots</span>
        <span className="text-foreground-subtle text-xs tabular-nums">
          {sceneTotalSeconds(shots)}s total
        </span>
      </div>

      <ol className="flex flex-col gap-2">
        {shots.map((shot, position) => {
          const window = windows[position];
          return (
            <li
              key={position}
              className="border-border bg-surface-raised flex flex-col gap-2 rounded-xl border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground-muted text-xs font-semibold tabular-nums">
                  Shot {position + 1} ({window?.startSeconds ?? 0}-{window?.endSeconds ?? 0}s)
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  // The last shot is the scene — removing it would leave a clip of no length.
                  disabled={shots.length === 1}
                  onClick={() => onChange(shots.filter((_, index) => index !== position))}
                  className="hover:text-destructive-text"
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[7rem_1fr]">
                <NumberInputField
                  label="Seconds"
                  value={shot.durationSeconds}
                  onChange={(value) =>
                    patch(position, { durationSeconds: Number.isFinite(value) ? value : 0 })
                  }
                  minValue={1}
                  maxValue={600}
                />
                <TextInputField
                  label="Camera"
                  value={shot.camera}
                  onChange={(value) => patch(position, { camera: value })}
                  placeholder="e.g. medium close-up, slow push in"
                />
              </div>

              <TextAreaField
                label="Action"
                value={shot.action}
                onChange={(value) => patch(position, { action: value })}
                rows={2}
                placeholder="What the subject does"
              />

              <TextAreaField
                label="Dialogue"
                value={shot.dialogueText}
                onChange={(value) => patch(position, { dialogueText: value })}
                rows={2}
                placeholder="Nadia (whispered): don't turn around"
                hint="Spoken over this shot. One line per row, “Speaker (delivery): line”."
              />
            </li>
          );
        })}
      </ol>

      <div>
        <Button size="xs" variant="outline" onClick={() => onChange([...shots, emptyShot()])}>
          <Plus aria-hidden="true" />
          Add shot
        </Button>
      </div>
    </div>
  );
}

export interface SceneSpecFormProps {
  /** Which project's roster the preview's `@handle` mentions link into. */
  projectId: string;
  value: SceneSpecDraft;
  onChange: (draft: SceneSpecDraft) => void;
}

export function SceneSpecForm({ projectId, value, onChange }: SceneSpecFormProps) {
  function patch(patchValue: Partial<SceneSpecDraft>) {
    onChange({ ...value, ...patchValue });
  }

  return (
    <div className="flex flex-col gap-3">
      <TextAreaField
        label="Style"
        value={value.style}
        onChange={(next) => patch({ style: next })}
        rows={2}
        placeholder="Film stock, grade, realism level, motion feel"
        hint="Use @handles to pull in characters, styles or locations — in any block."
      />
      <TextAreaField
        label="Setting"
        value={value.setting}
        onChange={(next) => patch({ setting: next })}
        rows={3}
        placeholder="Location, time, conditions, environment"
      />

      <ShotRows shots={value.shots} onChange={(shots) => patch({ shots })} />

      <TextAreaField
        label="Lighting"
        value={value.lighting}
        onChange={(next) => patch({ lighting: next })}
        rows={2}
        placeholder="Key light source, colour, contrast"
      />
      <TextAreaField
        label="Audio"
        value={value.audio}
        onChange={(next) => patch({ audio: next })}
        rows={2}
        placeholder="Ambience, sound effects, music"
        hint="Non-verbal only — spoken words go in a shot's Dialogue."
      />
      <TextAreaField
        label="Negative"
        value={value.negative}
        onChange={(next) => patch({ negative: next })}
        rows={2}
        placeholder="What the shot must avoid"
      />

      <div className="border-border bg-surface-raised rounded-xl border p-3">
        <span className="text-eyebrow">Prompt this beat renders to</span>
        <p className="text-foreground-muted mt-1.5 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          <MentionText text={draftToPrompt(value)} projectId={projectId} />
        </p>
      </div>
    </div>
  );
}
SceneSpecForm.displayName = 'SceneSpecForm';

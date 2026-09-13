/**
 * The shape every scene is written in, and the block prompt it renders to.
 *
 * One scene is one generation — a single clip cut into shots inside itself, never a whole episode —
 * so every timing here is relative to that clip: shot one starts at 0s and the last one ends at the
 * scene's duration. That is why the scene has no duration field of its own; it is the sum of its
 * shots, and `sceneTotalSeconds` is the only place that arithmetic happens.
 *
 * `formatScenePrompt` is the single renderer, shared by the editor's live preview and by the
 * generation path (`scene-generation.ts`) — the point being that what the user reads under the form
 * is the prompt, not an approximation of it.
 *
 * Deliberately dependency-free: this module is imported by client components, by `@/lib/validations`
 * and by `@/ai/*`, so it must not reach into any of them.
 */

export interface ScenePromptShot {
  durationSeconds: number;
  /** Framing + movement, e.g. "medium close-up, slow push in". */
  camera: string;
  /** What the subject does. May contain `@handle` mentions. */
  action: string;
}

export interface ScenePromptDialogueLine {
  /** 1-based position of the shot this line is spoken over. */
  shot: number;
  speaker: string;
  /** How it is delivered, e.g. "whispered, out of breath". */
  delivery: string;
  line: string;
}

/** The authored half of a scene — everything `formatScenePrompt` needs, and nothing else. */
export interface ScenePromptInput {
  style: string;
  setting: string;
  shots: ScenePromptShot[];
  lighting: string;
  audio: string;
  dialogue: ScenePromptDialogueLine[];
  negative: string;
}

/** Only `[DIALOGUE]` ever renders this — every other empty block is dropped. */
export const EMPTY_BLOCK = 'none';

export function sceneTotalSeconds(shots: readonly ScenePromptShot[]): number {
  return shots.reduce((sum, shot) => sum + (Number.isFinite(shot.durationSeconds) ? shot.durationSeconds : 0), 0);
}

export interface ShotWindow {
  /** 1-based, matching the "Shot N" label and a dialogue line's `shot`. */
  position: number;
  startSeconds: number;
  endSeconds: number;
}

/** Shots are contiguous by construction — each one starts where the previous cut. */
export function shotWindows(shots: readonly ScenePromptShot[]): ShotWindow[] {
  let elapsed = 0;
  return shots.map((shot, position) => {
    const startSeconds = elapsed;
    elapsed += Number.isFinite(shot.durationSeconds) ? shot.durationSeconds : 0;
    return { position: position + 1, startSeconds, endSeconds: elapsed };
  });
}

/** Blocks are prose, so a fragment the user typed without a full stop still reads as a sentence. */
function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?…:;,]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** An empty block is left out entirely — see `formatScenePrompt`. */
function block(name: string, body: string): string {
  const trimmed = body.trim();
  return trimmed ? `[${name}]\n${trimmed}` : '';
}

function formatShots(shots: readonly ScenePromptShot[]): string {
  const windows = shotWindows(shots);
  return shots
    .map((shot, position) => {
      const window = windows[position];
      const range = `${window?.startSeconds ?? 0}-${window?.endSeconds ?? 0}s`;
      const body = [sentence(shot.camera), sentence(shot.action)].filter(Boolean).join(' ');
      // A shot with nothing written in it still holds its slice of the clip, so the window stays;
      // only the colon goes, because a header ending in one promises text that isn't there.
      return body ? `Shot ${position + 1} (${range}): ${body}` : `Shot ${position + 1} (${range})`;
    })
    // "Cut to:" between shots, never after the last one — it is the cut, so there is nothing to
    // announce once there is no shot left to cut to.
    .join('\nCut to:\n');
}

function formatDialogue(dialogue: readonly ScenePromptDialogueLine[]): string {
  return dialogue
    .map((entry) => {
      const speaker = entry.speaker.trim();
      const delivery = entry.delivery.trim();
      const who = [speaker || 'Voice', delivery ? `(${delivery})` : ''].filter(Boolean).join(' ');
      return `Shot ${entry.shot} — ${who}: "${entry.line.trim()}"`;
    })
    .join('\n');
}

/**
 * The prompt, exactly as it is sent. A block with nothing in it is left out rather than written as
 * `none` — an empty header is noise the model still has to read, and the prompt should be only what
 * the writer actually decided.
 *
 * `[DIALOGUE]` is the one exception, and it is the format's own: it says `none` when there are no
 * lines, because silence has to be *stated*. Left out, a video model with native audio fills the
 * gap with invented speech; that is what the block exists to prevent.
 */
export function formatScenePrompt(scene: ScenePromptInput): string {
  return [
    block('STYLE', scene.style),
    block('SETTING', scene.setting),
    block('SHOTS', formatShots(scene.shots)),
    block('LIGHTING', scene.lighting),
    block('AUDIO', scene.audio),
    block('DIALOGUE', formatDialogue(scene.dialogue) || EMPTY_BLOCK),
    block('NEGATIVE', scene.negative),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * One line describing the beat, for the places that used to read `description`: beat lists, the
 * research target in `scenesNode`, continuity summaries. Prefers the setting, since that is what
 * distinguishes one beat from the next, and falls back to the first thing that happens.
 */
export function sceneHeadline(scene: ScenePromptInput): string {
  const candidates = [scene.setting, scene.shots.map((shot) => shot.action).find((action) => action.trim()) ?? '', scene.style];
  const found = candidates.find((candidate) => candidate.trim());
  return found ? found.trim().replace(/\s+/g, ' ') : '';
}

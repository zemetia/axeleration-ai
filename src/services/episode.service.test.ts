import { describe, expect, it } from 'vitest';

import type { SceneBreakdown, SceneSpec } from '@/ai/prompts/script.schema';
import type { SceneSpecInput } from '@/types/value-objects';

import {
  appendSceneSpec,
  deriveEpisodeTitle,
  mergeResearchPatch,
  nextScriptStatus,
  nextStatusAfterManualWrite,
  readScriptDraft,
  removeSceneSpec,
} from './episode.service';

describe('deriveEpisodeTitle', () => {
  it('takes the first few words of the idea text', () => {
    expect(deriveEpisodeTitle('Luna discovers a hidden door behind the old clock tower and decides to investigate')).toBe(
      'Luna discovers a hidden door behind the old',
    );
  });

  it('leaves short ideas untouched', () => {
    expect(deriveEpisodeTitle('A quiet day at the beach')).toBe('A quiet day at the beach');
  });

  it('truncates to maxChars even within the word limit', () => {
    const longWord = 'a'.repeat(80);
    expect(deriveEpisodeTitle(longWord, 8, 60).length).toBe(60);
  });

  it('trims surrounding whitespace and collapses internal runs', () => {
    expect(deriveEpisodeTitle('  Luna   finds   a   map  ')).toBe('Luna finds a map');
  });
});

describe('nextStatusAfterManualWrite', () => {
  it('turns an unwritten stage into one that can be approved', () => {
    expect(nextStatusAfterManualWrite('PENDING')).toBe('READY');
  });

  it('clears a failed run — the hand-written version replaces it', () => {
    expect(nextStatusAfterManualWrite('FAILED')).toBe('READY');
  });

  it('leaves READY alone', () => {
    expect(nextStatusAfterManualWrite('READY')).toBe('READY');
  });

  it('does not silently un-approve an accepted stage', () => {
    expect(nextStatusAfterManualWrite('APPROVED')).toBe('APPROVED');
  });

  it('passes GENERATING through — the caller refuses that case before reaching here', () => {
    expect(nextStatusAfterManualWrite('GENERATING')).toBe('GENERATING');
  });
});

describe('nextScriptStatus', () => {
  it('keeps a logline-only draft unapprovable — there are no beats to break down', () => {
    expect(nextScriptStatus('PENDING', 0)).toBe('PENDING');
  });

  it('reverts to PENDING when the last beat is deleted', () => {
    expect(nextScriptStatus('READY', 0)).toBe('PENDING');
  });

  it('becomes approvable as soon as one beat exists', () => {
    expect(nextScriptStatus('PENDING', 1)).toBe('READY');
  });

  it('leaves an approved script approved while it still has beats', () => {
    expect(nextScriptStatus('APPROVED', 3)).toBe('APPROVED');
  });
});

/** A canonical beat: one shot, everything else empty — the shape `normalizeScene` produces. */
function beat(index: number, action: string, durationSeconds = 8): SceneSpec {
  return {
    index,
    durationSeconds,
    style: '',
    setting: '',
    shots: [{ durationSeconds, camera: '', action }],
    lighting: '',
    audio: '',
    dialogue: [],
    negative: '',
  };
}

function beatInput(action: string, durationSeconds = 8): SceneSpecInput {
  const { index: _index, durationSeconds: _duration, ...input } = beat(1, action, durationSeconds);
  return input;
}

describe('readScriptDraft', () => {
  it('returns an empty draft for a stage nothing has written yet', () => {
    expect(readScriptDraft(null)).toEqual({ logline: '', scenes: [] });
  });

  it('keeps a partial draft the schema would reject for having no scenes', () => {
    expect(readScriptDraft({ logline: 'A quiet heist' })).toEqual({ logline: 'A quiet heist', scenes: [] });
  });

  it('passes a valid breakdown through untouched', () => {
    const script: SceneBreakdown = { logline: 'A quiet heist', scenes: [beat(1, 'The door opens')] };
    expect(readScriptDraft(script as unknown as Record<string, unknown>)).toEqual(script);
  });

  it('reads a beat written before the block format as one shot', () => {
    const legacy = {
      logline: 'A quiet heist',
      scenes: [{ index: 1, durationSeconds: 8, description: 'The door opens', mood: 'tense', dialogue: [] }],
    };
    // The prose was what happens, so it becomes the shot's action; the mood was how it should
    // feel, so it becomes the style. Nothing the user wrote is dropped on the way through.
    expect(readScriptDraft(legacy)).toEqual({
      logline: 'A quiet heist',
      scenes: [{ ...beat(1, 'The door opens'), style: 'tense' }],
    });
  });

  it('drops only the beat it cannot read, not the draft around it', () => {
    const draft = { logline: '', scenes: [beat(1, 'a'), { nonsense: true }, beat(3, 'c')] };
    expect(readScriptDraft(draft as unknown as Record<string, unknown>).scenes.map((scene) => scene.index)).toEqual([1, 3]);
  });
});

describe('appendSceneSpec', () => {
  const empty: SceneBreakdown = { logline: '', scenes: [] };

  it('numbers the first hand-written beat 1', () => {
    const next = appendSceneSpec(empty, beatInput('Rain on the window', 6));
    expect(next.scenes.map((scene) => scene.index)).toEqual([1]);
  });

  it('continues past a gap instead of reusing a freed index', () => {
    const script: SceneBreakdown = { logline: '', scenes: [beat(1, 'a'), beat(4, 'b')] };
    const next = appendSceneSpec(script, beatInput('c'));
    expect(next.scenes.map((scene) => scene.index)).toEqual([1, 4, 5]);
  });

  it('derives the beat’s duration from its shots rather than taking one', () => {
    const next = appendSceneSpec(empty, {
      ...beatInput('a'),
      shots: [
        { durationSeconds: 3, camera: '', action: 'a' },
        { durationSeconds: 5, camera: '', action: 'b' },
      ],
    });
    expect(next.scenes[0]?.durationSeconds).toBe(8);
  });
});

describe('removeSceneSpec', () => {
  const script: SceneBreakdown = { logline: '', scenes: [beat(1, 'a'), beat(2, 'b'), beat(3, 'c')] };

  it('compacts to 1..n when nothing has been generated yet', () => {
    const next = removeSceneSpec(script, 2, { reindex: true });
    expect(next.scenes.map((scene) => [scene.index, scene.shots[0]?.action])).toEqual([
      [1, 'a'],
      [2, 'c'],
    ]);
  });

  it('leaves a gap once generated scenes key off the index', () => {
    const next = removeSceneSpec(script, 2, { reindex: false });
    expect(next.scenes.map((scene) => scene.index)).toEqual([1, 3]);
  });
});

describe('mergeResearchPatch', () => {
  it('creates a dossier on demand for a mode that never had one', () => {
    const next = mergeResearchPatch(
      { mode: 'HUMAN', summary: 'notes' },
      { findings: [{ claim: 'Tokyo is humid in July', detail: '80% average', sources: [] }] },
    );
    expect(next['research']).toMatchObject({
      summary: 'notes',
      findings: [{ claim: 'Tokyo is humid in July' }],
      visualReferences: [],
      openQuestions: [],
    });
  });

  it('drops the dossier again when the last finding is removed', () => {
    const output = { mode: 'AI_CDP', summary: 's', research: { summary: 's', findings: [{ claim: 'c', detail: 'd' }] } };
    expect(mergeResearchPatch(output, { findings: [] })).toEqual({ mode: 'AI_CDP', summary: 's' });
  });

  it('mirrors a summary edit into both copies so they cannot drift', () => {
    const output = { summary: 'old', research: { summary: 'old', findings: [{ claim: 'c', detail: 'd' }] } };
    const next = mergeResearchPatch(output, { summary: '  new  ' });
    expect(next['summary']).toBe('new');
    expect((next['research'] as { summary: string }).summary).toBe('new');
  });

  it('keeps existing findings when only the summary is patched', () => {
    const output = { summary: 'old', research: { findings: [{ claim: 'c', detail: 'd' }] } };
    const next = mergeResearchPatch(output, { summary: 'new' });
    expect((next['research'] as { findings: unknown[] }).findings).toHaveLength(1);
  });
});

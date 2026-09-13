import { describe, expect, it } from 'vitest';

import { dialogueToText, textToDialogue } from './dialogue-text';

describe('textToDialogue', () => {
  it('reads the speaker, delivery and line, and takes the shot from the box it is in', () => {
    expect(textToDialogue('Nadia (whispered, out of breath): don’t turn around', 2)).toEqual([
      { shot: 2, speaker: 'Nadia', delivery: 'whispered, out of breath', line: 'don’t turn around' },
    ]);
  });

  it('keeps a bare line rather than refusing it', () => {
    expect(textToDialogue('just say it', 1)).toEqual([{ shot: 1, speaker: '', delivery: '', line: 'just say it' }]);
  });

  it('strips the quotes the block format prints around a line', () => {
    expect(textToDialogue('Nadia: "run"', 1)[0]?.line).toBe('run');
  });

  it('ignores a pasted "Shot N" in favour of the shot it was pasted into', () => {
    // Pasted from the rendered prompt, or moved between two shots' boxes — the box wins, because
    // that is the one the user can see while they are typing.
    expect(textToDialogue('Shot 5 — Nadia: run', 2)[0]?.shot).toBe(2);
  });

  it('drops blank rows instead of storing empty lines', () => {
    expect(textToDialogue('Nadia: run\n\n   \nLuna: wait', 1)).toHaveLength(2);
  });

  it('round-trips what it renders', () => {
    const dialogue = [
      { shot: 3, speaker: 'Nadia', delivery: 'whispered', line: 'don’t' },
      { shot: 3, speaker: 'Luna', delivery: '', line: 'too late' },
    ];
    expect(textToDialogue(dialogueToText(dialogue), 3)).toEqual(dialogue);
  });
});

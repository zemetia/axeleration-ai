import { describe, expect, it } from 'vitest';

import { formatScenePrompt, sceneHeadline, shotWindows, type ScenePromptInput } from './scene-prompt';

function scene(overrides: Partial<ScenePromptInput> = {}): ScenePromptInput {
  return {
    style: '',
    setting: '',
    shots: [],
    lighting: '',
    audio: '',
    dialogue: [],
    negative: '',
    ...overrides,
  };
}

describe('shotWindows', () => {
  it('lays the shots end to end from zero', () => {
    const windows = shotWindows([
      { durationSeconds: 3, camera: '', action: '' },
      { durationSeconds: 5, camera: '', action: '' },
      { durationSeconds: 2, camera: '', action: '' },
    ]);
    expect(windows).toEqual([
      { position: 1, startSeconds: 0, endSeconds: 3 },
      { position: 2, startSeconds: 3, endSeconds: 8 },
      { position: 3, startSeconds: 8, endSeconds: 10 },
    ]);
  });
});

describe('formatScenePrompt', () => {
  it('renders every block, timing the shots and cutting between them', () => {
    const prompt = formatScenePrompt(
      scene({
        style: '16mm film, muted grade, handheld',
        setting: 'a flooded car park at dawn, @luna alone',
        shots: [
          { durationSeconds: 3, camera: 'wide, slow push in', action: '@luna steps into the water' },
          { durationSeconds: 5, camera: 'medium close-up', action: 'she looks back at the ramp' },
        ],
        lighting: 'low sun from camera left, cold shadows',
        audio: 'rain on concrete, distant traffic',
        dialogue: [{ shot: 2, speaker: 'Luna', delivery: 'whispered', line: 'not again' }],
        negative: 'text overlays, warp, extra limbs',
      }),
    );

    expect(prompt).toBe(
      [
        '[STYLE]',
        // Prose blocks go through verbatim; only the shot line is assembled from two halves and so
        // needs the punctuation between them.
        '16mm film, muted grade, handheld',
        '',
        '[SETTING]',
        'a flooded car park at dawn, @luna alone',
        '',
        '[SHOTS]',
        'Shot 1 (0-3s): wide, slow push in. @luna steps into the water.',
        'Cut to:',
        'Shot 2 (3-8s): medium close-up. she looks back at the ramp.',
        '',
        '[LIGHTING]',
        'low sun from camera left, cold shadows',
        '',
        '[AUDIO]',
        'rain on concrete, distant traffic',
        '',
        '[DIALOGUE]',
        'Shot 2 — Luna (whispered): "not again"',
        '',
        '[NEGATIVE]',
        'text overlays, warp, extra limbs',
      ].join('\n'),
    );
  });

  it('leaves out a block with nothing in it instead of writing "none"', () => {
    const prompt = formatScenePrompt(
      scene({ setting: 'a rooftop', shots: [{ durationSeconds: 4, camera: 'static wide', action: '' }] }),
    );
    expect(prompt).toBe(['[SETTING]', 'a rooftop', '', '[SHOTS]', 'Shot 1 (0-4s): static wide.', '', '[DIALOGUE]', 'none'].join('\n'));
  });

  it('always states "none" for dialogue, since silence has to be asked for', () => {
    // Left out, a video model with native audio fills the gap with invented speech.
    expect(formatScenePrompt(scene({ shots: [{ durationSeconds: 4, camera: 'wide', action: 'she waits' }] }))).toContain(
      '[DIALOGUE]\nnone',
    );
  });

  it('keeps a blank shot’s window but drops the colon promising text after it', () => {
    const prompt = formatScenePrompt(scene({ shots: [{ durationSeconds: 4, camera: '', action: '' }] }));
    expect(prompt).toContain('[SHOTS]\nShot 1 (0-4s)\n');
  });

  it('leaves "Cut to:" out of a single-shot beat', () => {
    const prompt = formatScenePrompt(scene({ shots: [{ durationSeconds: 8, camera: 'static', action: 'she waits' }] }));
    expect(prompt).toContain('Shot 1 (0-8s): static. she waits.');
    expect(prompt).not.toContain('Cut to:');
  });

  it('does not double up punctuation the writer already ended a shot half on', () => {
    const prompt = formatScenePrompt(scene({ shots: [{ durationSeconds: 2, camera: 'wide?', action: 'she runs!' }] }));
    expect(prompt).toContain('Shot 1 (0-2s): wide? she runs!');
  });

  it('names an unattributed line rather than opening with a bare colon', () => {
    const prompt = formatScenePrompt(
      scene({
        shots: [{ durationSeconds: 4, camera: '', action: '' }],
        dialogue: [{ shot: 1, speaker: '', delivery: '', line: 'get out' }],
      }),
    );
    expect(prompt).toContain('Shot 1 — Voice: "get out"');
  });
});

describe('sceneHeadline', () => {
  it('prefers the setting, since that is what tells two beats apart', () => {
    expect(sceneHeadline(scene({ setting: 'a flooded car park', style: '16mm' }))).toBe('a flooded car park');
  });

  it('falls back to the first shot that has an action', () => {
    expect(
      sceneHeadline(
        scene({
          shots: [
            { durationSeconds: 2, camera: 'wide', action: '' },
            { durationSeconds: 2, camera: '', action: 'she turns' },
          ],
        }),
      ),
    ).toBe('she turns');
  });

  it('is empty for a beat with nothing written in it', () => {
    expect(sceneHeadline(scene({ shots: [{ durationSeconds: 4, camera: 'wide', action: '' }] }))).toBe('');
  });
});

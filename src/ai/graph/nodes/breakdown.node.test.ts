import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneBreakdown } from '@/ai/prompts/script.schema';

const { script, withStage } = vi.hoisted(() => ({
  script: vi.fn(),
  withStage: vi.fn(),
}));

vi.mock('@/services', () => ({ episodeService: { script } }));
vi.mock('../stage-io', () => ({ withStage }));

const { breakdownNode } = await import('./breakdown.node');

const BREAKDOWN: SceneBreakdown = {
  logline: 'Luna finds the door behind the clock tower.',
  scenes: [
    {
      index: 1,
      durationSeconds: 8,
      style: 'tense',
      setting: 'an empty alley at night',
      shots: [{ durationSeconds: 8, camera: 'wide, slow dolly', action: '@luna walks the empty alley' }],
      lighting: '',
      audio: '',
      dialogue: [],
      negative: '',
    },
    {
      index: 2,
      durationSeconds: 6,
      style: '',
      setting: 'the clock tower',
      shots: [{ durationSeconds: 6, camera: 'medium', action: 'the door swings open' }],
      lighting: '',
      audio: '',
      dialogue: [],
      negative: '',
    },
  ],
};

function stateWith(overrides: Record<string, unknown> = {}) {
  return { episodeId: 'ep_1', projectId: 'proj_1', ...overrides } as never;
}

/** Runs the node body `withStage` was handed, so the assertions are about the body, not the wrapper. */
beforeEach(() => {
  vi.clearAllMocks();
  withStage.mockImplementation(async (_episodeId, _kind, run) => (await run({ attempt: 0 })).result);
});

describe('breakdownNode (pass-through stub)', () => {
  it('round-trips the SCRIPT breakdown unchanged', async () => {
    script.mockResolvedValue(BREAKDOWN);

    const update = await breakdownNode(stateWith());

    // T15 is behaviour-neutral: whatever SCRIPT produced is exactly what SCENES must receive.
    expect(update.script).toEqual(BREAKDOWN);
    expect(withStage).toHaveBeenCalledWith('ep_1', 'BREAKDOWN', expect.any(Function));
  });

  it('writes the same breakdown as the stage output', async () => {
    script.mockResolvedValue(BREAKDOWN);

    await breakdownNode(stateWith());
    const body = withStage.mock.calls[0]?.[2] as (ctx: { attempt: number }) => Promise<{ output: unknown }>;

    expect((await body({ attempt: 0 })).output).toEqual(BREAKDOWN);
  });

  it('prefers the stored SCRIPT output over the checkpointed channel', async () => {
    // The channel holds the last run's beats; the row holds the user's edits. Same DB-before-channel
    // precedence every other node uses — reversing it silently discards hand-edited beats.
    const stale: SceneBreakdown = { logline: 'stale', scenes: [] };
    script.mockResolvedValue(BREAKDOWN);

    const update = await breakdownNode(stateWith({ script: stale }));

    expect(update.script).toEqual(BREAKDOWN);
  });

  it('falls back to the channel when the stage row holds nothing yet', async () => {
    script.mockResolvedValue(null);

    const update = await breakdownNode(stateWith({ script: BREAKDOWN }));

    expect(update.script).toEqual(BREAKDOWN);
  });

  it('fails when SCRIPT has produced nothing at all', async () => {
    script.mockResolvedValue(null);

    await expect(breakdownNode(stateWith())).rejects.toThrow(/SCRIPT stage must run first/);
  });

  it('clears the regenerate note, so it cannot leak into the next stage', async () => {
    script.mockResolvedValue(BREAKDOWN);

    const update = await breakdownNode(stateWith({ regenerateNote: 'make it darker' }));

    expect(update.regenerateNote).toBe('');
  });
});

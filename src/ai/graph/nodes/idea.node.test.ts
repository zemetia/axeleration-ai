import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdeaCritique } from '@/ai/prompts/idea-critic.schema';

const { invoke, getChatModel, withStage, services } = vi.hoisted(() => {
  const invoke = vi.fn();
  return {
    invoke,
    getChatModel: vi.fn(),
    withStage: vi.fn(),
    services: {
      idea: vi.fn(),
      get: vi.fn(),
      research: vi.fn(),
      setTitleIfEmpty: vi.fn(),
      projectGet: vi.fn(),
      continuity: vi.fn(),
      assets: vi.fn(),
    },
  };
});

/**
 * Both prompts are stubbed as objects that record which one was piped, so a test can assert *which*
 * prompt ran and with what — the distinction between refine and regenerate is entirely which
 * template received the call, and mocking the model alone would not show it.
 */
vi.mock('@/ai/prompts/idea.prompt', () => ({
  ideaPrompt: { pipe: () => ({ invoke: (input: unknown) => invoke('fresh', input) }) },
}));
vi.mock('@/ai/prompts/refine-idea.prompt', () => ({
  refineIdeaPrompt: { pipe: () => ({ invoke: (input: unknown) => invoke('refine', input) }) },
}));
vi.mock('@/ai/router/model-router', () => ({ getChatModel }));
vi.mock('@/ai/research/research-agent', () => ({ formatResearchDossier: () => 'dossier' }));
vi.mock('@/assets/roster', () => ({ buildAssetRoster: () => '@luna — Character: Luna' }));
vi.mock('@/ai/prompts/project-brief', () => ({ buildProjectBrief: () => 'brief' }));
vi.mock('../stage-io', () => ({ withStage }));
vi.mock('@/services/episode.service', () => ({ deriveEpisodeTitle: (text: string) => text.slice(0, 10) }));
vi.mock('@/services', () => ({
  episodeService: {
    idea: services.idea,
    get: services.get,
    research: services.research,
    setTitleIfEmpty: services.setTitleIfEmpty,
  },
  projectService: { get: services.projectGet },
  contextService: { getContinuityState: services.continuity },
  assetService: { list: services.assets },
}));

const { ideaNode } = await import('./idea.node');

function stateWith(overrides: Record<string, unknown> = {}) {
  return { episodeId: 'ep_1', projectId: 'proj_1', ideaMode: 'fresh', regenerateNote: '', ...overrides } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  withStage.mockImplementation(async (_episodeId, _kind, run) => (await run({ attempt: 0 })).result);
  getChatModel.mockResolvedValue({});
  invoke.mockResolvedValue({ content: 'A revised idea about Luna.' });
  services.projectGet.mockResolvedValue({ premise: 'p', typeLabel: 'series', modelConfig: undefined });
  services.get.mockResolvedValue({ number: 3 });
  services.research.mockResolvedValue({ dossier: null, summary: 'notes' });
  services.continuity.mockResolvedValue({ summary: 'so far' });
  services.assets.mockResolvedValue([]);
  services.idea.mockResolvedValue(null);
  services.setTitleIfEmpty.mockResolvedValue(undefined);
});

/** The prompt id ('fresh' | 'refine') and the input object the node passed it. */
function lastCall() {
  const call = invoke.mock.calls.at(-1);
  return { prompt: call?.[0] as string, input: call?.[1] as Record<string, unknown> };
}

describe('ideaNode', () => {
  it('writes fresh by default, without the current idea in the prompt', async () => {
    services.idea.mockResolvedValue('The idea already on screen.');

    await ideaNode(stateWith());

    const { prompt, input } = lastCall();
    expect(prompt).toBe('fresh');
    expect(input).not.toHaveProperty('currentIdea');
    // A fresh write must not even read the stored idea — that read is what refine is for.
    expect(services.idea).not.toHaveBeenCalled();
  });

  it('refines the stored idea, passing it into the prompt', async () => {
    services.idea.mockResolvedValue('The idea already on screen.');

    await ideaNode(stateWith({ ideaMode: 'refine', regenerateNote: 'harder ending' }));

    const { prompt, input } = lastCall();
    expect(prompt).toBe('refine');
    expect(input['currentIdea']).toBe('The idea already on screen.');
    expect(input['userNote']).toBe('harder ending');
  });

  it('prefers the stored idea over the checkpointed channel', async () => {
    // The channel holds the last generated text; the row holds what the user edited by hand.
    services.idea.mockResolvedValue('hand-edited');

    await ideaNode(stateWith({ ideaMode: 'refine', idea: 'stale from the channel' }));

    expect(lastCall().input['currentIdea']).toBe('hand-edited');
  });

  it('falls back to the channel when the row holds nothing', async () => {
    services.idea.mockResolvedValue(null);

    await ideaNode(stateWith({ ideaMode: 'refine', idea: 'from the channel' }));

    expect(lastCall().prompt).toBe('refine');
    expect(lastCall().input['currentIdea']).toBe('from the channel');
  });

  it('falls back to a fresh write when there is no idea to refine, instead of throwing', async () => {
    services.idea.mockResolvedValue(null);

    const update = await ideaNode(stateWith({ ideaMode: 'refine' }));

    // Pressing Refine in a state where it means nothing is a UI condition to recover from, not a
    // pipeline failure — the stage still produces an idea.
    expect(lastCall().prompt).toBe('fresh');
    expect(update.idea).toBe('A revised idea about Luna.');
  });

  it('treats a whitespace-only stored idea as nothing to refine', async () => {
    services.idea.mockResolvedValue('   \n  ');

    await ideaNode(stateWith({ ideaMode: 'refine' }));

    expect(lastCall().prompt).toBe('fresh');
  });

  it('resets ideaMode to fresh, so a refine cannot leak into the next run', async () => {
    services.idea.mockResolvedValue('an idea');

    const update = await ideaNode(stateWith({ ideaMode: 'refine' }));
    expect(update.ideaMode).toBe('fresh');

    // The leak only shows on the *second* run: the channel reducer replaces, so a node that forgot
    // to clear it would silently refine again on the next Regenerate.
    invoke.mockClear();
    await ideaNode(stateWith({ ideaMode: update.ideaMode }));
    expect(lastCall().prompt).toBe('fresh');
  });

  it('clears the regenerate note', async () => {
    const update = await ideaNode(stateWith({ regenerateNote: 'make it darker' }));

    expect(update.regenerateNote).toBe('');
  });

  it('feeds the critic’s weaknesses and open questions into a refine', async () => {
    const critique: IdeaCritique = {
      scores: { premiseFit: 20, conflictClarity: 10, freshness: 20, visualFeasibility: 20 },
      score: 70,
      weaknesses: [{ axis: 'conflictClarity', detail: 'no stake', fixable: 'refine' }],
      openQuestions: ['when did the tower close?'],
    };
    services.idea.mockResolvedValue('an idea');

    await ideaNode(stateWith({ ideaMode: 'refine', ideaCritique: critique }));

    const critiqueText = lastCall().input['critique'] as string;
    expect(critiqueText).toContain('conflictClarity: no stake');
    expect(critiqueText).toContain('when did the tower close?');
  });

  it('sends "(none)" when the critic had nothing to say', async () => {
    services.idea.mockResolvedValue('an idea');

    await ideaNode(stateWith({ ideaMode: 'refine' }));

    expect(lastCall().input['critique']).toBe('(none)');
  });

  it('records the mode in the stage output', async () => {
    services.idea.mockResolvedValue('an idea');

    await ideaNode(stateWith({ ideaMode: 'refine' }));
    const body = withStage.mock.calls[0]?.[2] as (ctx: { attempt: number }) => Promise<{ output: unknown }>;

    expect((await body({ attempt: 0 })).output).toMatchObject({ mode: 'refine' });
  });

  it('backfills the title through setTitleIfEmpty, which is what stops a refine renaming an episode', async () => {
    services.idea.mockResolvedValue('an idea');

    await ideaNode(stateWith({ ideaMode: 'refine' }));

    // The guard lives in the service (it writes only when `title` is null); the node's part of the
    // contract is to keep going through it rather than writing the title directly.
    expect(services.setTitleIfEmpty).toHaveBeenCalledWith('ep_1', expect.any(String));
  });

  it('does not fail the stage when the title backfill throws', async () => {
    services.setTitleIfEmpty.mockRejectedValue(new Error('db down'));

    const update = await ideaNode(stateWith());

    expect(update.idea).toBe('A revised idea about Luna.');
  });
});

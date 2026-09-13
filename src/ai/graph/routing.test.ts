import { describe, expect, it } from 'vitest';

import { routeAfterIdeaCritic } from './routing';
import type { EpisodeGraphState } from './state';

function stateWith(overrides: Partial<EpisodeGraphState> = {}): EpisodeGraphState {
  return {
    episodeId: 'ep_1',
    projectId: 'proj_1',
    costTotal: 0,
    regenerateNote: '',
    sceneScope: 'missing',
    ideaMode: 'fresh',
    ideaIteration: 0,
    ...overrides,
  } as EpisodeGraphState;
}

/**
 * The seam T19 builds the RESEARCH ↔ IDEA loop on. Locking the constant here is deliberate: it means
 * the moment routing starts making a real decision, the change shows up as a failing test rather
 * than as a pipeline that quietly began looping.
 */
describe('routeAfterIdeaCritic', () => {
  it('always continues to SCRIPT — the loop is not built yet', () => {
    expect(routeAfterIdeaCritic(stateWith())).toBe('SCRIPT');
  });

  it('ignores the critique and the iteration count for now', () => {
    const looping = stateWith({
      ideaIteration: 9,
      ideaCritique: {
        scores: { premiseFit: 5, conflictClarity: 5, freshness: 5, visualFeasibility: 5 },
        score: 20,
        weaknesses: [{ axis: 'freshness', detail: 'reads like episode 3', fixable: 'research' }],
        openQuestions: ['what year is this set in?', 'who runs the harbour?'],
      },
    });

    expect(routeAfterIdeaCritic(looping)).toBe('SCRIPT');
  });
});

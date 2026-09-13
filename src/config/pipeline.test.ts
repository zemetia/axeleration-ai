import { describe, expect, it } from 'vitest';

import { GRAPH_VERSION, INTERRUPT_AFTER, STAGE_ORDER, nextStageAfter, stagesAfter } from './pipeline';

describe('STAGE_ORDER', () => {
  it('is the documented eight-stage pipeline, in order', () => {
    expect([...STAGE_ORDER]).toEqual([
      'RESEARCH',
      'IDEA',
      'SCRIPT',
      'BREAKDOWN',
      'SCENES',
      'VOICE',
      'MUSIC',
      'RENDER',
    ]);
  });

  it('puts BREAKDOWN between SCRIPT and SCENES', () => {
    // The whole point of the stage: SCRIPT no longer feeds SCENES directly. A regression here is
    // silent at runtime — SCENES would just receive a breakdown nobody produced.
    expect(STAGE_ORDER.indexOf('BREAKDOWN')).toBe(STAGE_ORDER.indexOf('SCRIPT') + 1);
    expect(STAGE_ORDER.indexOf('SCENES')).toBe(STAGE_ORDER.indexOf('BREAKDOWN') + 1);
  });

  it('has no duplicates', () => {
    expect(new Set(STAGE_ORDER).size).toBe(STAGE_ORDER.length);
  });
});

describe('nextStageAfter', () => {
  it('names the stage Approve actually starts', () => {
    expect(nextStageAfter('SCRIPT')).toBe('BREAKDOWN');
    expect(nextStageAfter('BREAKDOWN')).toBe('SCENES');
  });

  it('returns null for the last stage, which starts nothing', () => {
    expect(nextStageAfter('RENDER')).toBeNull();
  });
});

describe('stagesAfter', () => {
  it('lists the downstream stages in order', () => {
    expect(stagesAfter('SCENES')).toEqual(['VOICE', 'MUSIC', 'RENDER']);
  });

  it('is empty for the last stage', () => {
    expect(stagesAfter('RENDER')).toEqual([]);
  });

  it('returns a fresh array, so a caller cannot mutate the shared order', () => {
    const first = stagesAfter('IDEA');
    first.pop();
    expect(stagesAfter('IDEA')).toHaveLength(first.length + 1);
  });
});

describe('INTERRUPT_AFTER', () => {
  it('parks after the critic instead of after IDEA', () => {
    // Interrupting after IDEA would leave the critique unwritten when the user reviews the idea;
    // interrupting after both would cost an extra Approve click for a node that shows nothing.
    expect(INTERRUPT_AFTER).toContain('IDEA_CRITIC');
    expect(INTERRUPT_AFTER).not.toContain('IDEA');
  });

  it('parks after every other stage', () => {
    for (const kind of STAGE_ORDER) {
      if (kind === 'IDEA') continue;
      expect(INTERRUPT_AFTER).toContain(kind);
    }
  });

  it('gives every stage exactly one park point', () => {
    expect(INTERRUPT_AFTER).toHaveLength(STAGE_ORDER.length);
  });
});

describe('GRAPH_VERSION', () => {
  it('is v2 — the shape with BREAKDOWN and the idea critic', () => {
    // A bare number is not much of an assertion, but the failure it guards is: bumping the graph
    // without bumping this leaves stale checkpoints resuming into wiring that no longer exists.
    expect(GRAPH_VERSION).toBe(2);
  });
});

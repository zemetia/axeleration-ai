import { describe, expect, it } from 'vitest';

import { CONTINUITY_MAX_CHARS, truncateSummary } from './continuity-chain';

describe('truncateSummary', () => {
  it('returns short text unchanged (trimmed)', () => {
    expect(truncateSummary('  hello  ', 100)).toBe('hello');
  });

  it('never exceeds maxChars, even on a model that ignores the instruction', () => {
    const long = 'x'.repeat(CONTINUITY_MAX_CHARS * 3);
    const result = truncateSummary(long);
    expect(result.length).toBeLessThanOrEqual(CONTINUITY_MAX_CHARS);
    expect(result.endsWith('…')).toBe(true);
  });

  it('is stable across repeated summarization (idempotent under re-truncation)', () => {
    const long = 'y'.repeat(CONTINUITY_MAX_CHARS * 2);
    const once = truncateSummary(long);
    const twice = truncateSummary(once);
    expect(twice).toBe(once);
  });
});

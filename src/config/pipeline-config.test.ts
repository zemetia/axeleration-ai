import { describe, expect, it } from 'vitest';

import { DEFAULT_PIPELINE_CONFIG, readPipelineConfig } from './pipeline-config';

describe('readPipelineConfig', () => {
  it('reads the flag when it is set', () => {
    expect(readPipelineConfig({ skipAudio: true })).toEqual({ skipAudio: true });
  });

  // The column predates every key in this schema, so most rows hold `null` or leftovers from
  // something else. None of that may fail a pipeline run.
  it('falls back to defaults for null, an empty object, and junk', () => {
    expect(readPipelineConfig(null)).toEqual(DEFAULT_PIPELINE_CONFIG);
    expect(readPipelineConfig({})).toEqual(DEFAULT_PIPELINE_CONFIG);
    expect(readPipelineConfig({ skipAudio: 'yes' })).toEqual(DEFAULT_PIPELINE_CONFIG);
    expect(readPipelineConfig('nonsense')).toEqual(DEFAULT_PIPELINE_CONFIG);
  });

  it('defaults to generating audio — the switch has to be turned on deliberately', () => {
    expect(DEFAULT_PIPELINE_CONFIG.skipAudio).toBe(false);
  });

  it('ignores unrelated keys already living in the column', () => {
    expect(readPipelineConfig({ somethingElse: 1, skipAudio: true })).toEqual({ skipAudio: true });
  });
});

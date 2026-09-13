import { describe, expect, it } from 'vitest';

import {
  blockedReason,
  readinessForEpisode,
  readinessForStage,
  type ReadinessInput,
} from './provider-readiness';

/**
 * The defaults these assertions lean on (`aiConfig.defaults`): llmText → anthropic,
 * textToVideo → wavespeed, tts → elevenlabs, music → replicate, videoAssembly → ffmpeg.
 */
const BASE: ReadinessInput = {
  modelConfig: undefined,
  researchMode: 'AI_CDP',
  sceneCount: 4,
  dialogueChars: 500,
  availableProviders: [],
  platformProviders: [],
};

function input(patch: Partial<ReadinessInput> = {}): ReadinessInput {
  return { ...BASE, ...patch };
}

describe('readinessForStage', () => {
  it('blocks a text stage with no credential and names the provider', () => {
    const result = readinessForStage('IDEA', input());
    expect(result.isReady).toBe(false);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]?.provider).toBe('anthropic');
    expect(result.missing[0]?.capability).toBe('llmText');
  });

  it('clears once the provider has a saved key', () => {
    expect(readinessForStage('IDEA', input({ availableProviders: ['anthropic'] })).isReady).toBe(
      true,
    );
  });

  it('honours a project override instead of the default provider', () => {
    const modelConfig = { llmText: { provider: 'sumopod', model: 'claude-haiku-4-5' } };
    expect(
      readinessForStage('IDEA', input({ modelConfig, availableProviders: ['anthropic'] })).isReady,
    ).toBe(false);
    expect(
      readinessForStage('IDEA', input({ modelConfig, availableProviders: ['sumopod'] })).isReady,
    ).toBe(true);
  });

  it('never blocks RENDER — ffmpeg runs locally and needs no credential', () => {
    expect(readinessForStage('RENDER', input()).isReady).toBe(true);
  });

  it('skips RESEARCH entirely when the mode calls no model', () => {
    expect(readinessForStage('RESEARCH', input({ researchMode: 'HUMAN' })).isReady).toBe(true);
    expect(readinessForStage('RESEARCH', input({ researchMode: 'SKIP' })).isReady).toBe(true);
    expect(readinessForStage('RESEARCH', input({ researchMode: 'AI_REASONING' })).isReady).toBe(
      false,
    );
  });

  it('does not require a video credential before there are any beats', () => {
    expect(readinessForStage('SCENES', input({ sceneCount: 0 })).isReady).toBe(true);
  });

  it('requires both the writer and the video model once beats exist', () => {
    const result = readinessForStage('SCENES', input({ availableProviders: ['anthropic'] }));
    expect(result.missing.map((entry) => entry.provider)).toEqual(['wavespeed']);
  });

  it('does not require TTS for a silent episode', () => {
    expect(readinessForStage('VOICE', input({ dialogueChars: 0 })).isReady).toBe(true);
  });

  /**
   * The env fallback lives in `resolveApiKey` inside `model-router.ts`, which only the LLM path
   * goes through — the video/TTS/music nodes call `getDecrypted` and get `''`. A platform key must
   * therefore never green-light a SCENES run.
   */
  it('lets a platform env key satisfy text, but not video', () => {
    const platform = input({ platformProviders: ['anthropic'] });
    expect(readinessForStage('IDEA', platform).isReady).toBe(true);
    expect(readinessForStage('SCENES', platform).missing.map((entry) => entry.capability)).toEqual([
      'textToVideo',
    ]);
  });
});

describe('readinessForEpisode', () => {
  it('de-duplicates a provider that blocks several stages', () => {
    const result = readinessForEpisode(input());
    // llmText/anthropic is needed by RESEARCH, IDEA, SCRIPT, SCENES, VOICE and MUSIC — one entry.
    expect(result.missing.filter((entry) => entry.capability === 'llmText')).toHaveLength(1);
    expect(result.isReady).toBe(false);
  });

  it('reports ready when every resolved provider has a key', () => {
    const result = readinessForEpisode(
      input({ availableProviders: ['anthropic', 'wavespeed', 'elevenlabs', 'replicate'] }),
    );
    expect(result.isReady).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe('blockedReason', () => {
  it('is null for a ready stage and for an unknown one', () => {
    expect(blockedReason(undefined)).toBeNull();
    expect(blockedReason({ isReady: true, missing: [] })).toBeNull();
  });

  it('names the provider and counts the rest', () => {
    const reason = blockedReason(readinessForStage('SCENES', input()));
    expect(reason).toContain('anthropic');
    expect(reason).toContain('1 more capability');
  });
});

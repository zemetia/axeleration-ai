import { describe, expect, it } from 'vitest';

import type { AssetVO } from '@/types/value-objects';

import { checkMentionPolicy, mentionWarning, validateMentions } from './validate';

function makeAsset(overrides: Partial<AssetVO> = {}): AssetVO {
  return {
    id: 'asset-1',
    projectId: 'project-1',
    type: 'CHARACTER',
    typeLabel: 'Character',
    lab: null,
    handle: 'luna',
    name: 'Luna',
    description: 'A courier with silver hair',
    refUrl: null,
    voiceId: null,
    attributes: {},
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const ROSTER = [
  makeAsset(),
  makeAsset({ id: 'a2', handle: 'rainy-alley', type: 'LOCATION', name: 'Rainy alley' }),
  makeAsset({ id: 'a3', handle: 'hero-city', type: 'LOCATION', name: 'Hero City' }),
];

describe('validateMentions', () => {
  it('separates handles the roster owns from ones it does not', () => {
    const v = validateMentions('@luna crosses @lunna in @rainy-alley', ROSTER);
    expect(v.mentioned).toEqual(['luna', 'rainy-alley']);
    expect(v.unknown).toEqual(['lunna']);
  });

  it('reports nothing unknown when the project has no assets — @anything is just prose there', () => {
    const v = validateMentions('She walks past @nowhere and waves at @someone', []);
    expect(v.unknown).toEqual([]);
    expect(v.mentioned).toEqual([]);
    expect(v.coverage).toBe(0);
  });

  it('treats a VOICE-only project as an empty roster — that is what the writer was shown', () => {
    const roster = [makeAsset({ id: 'v1', handle: 'narrator', type: 'VOICE', name: 'Narrator' })];
    expect(validateMentions('She walks past @nowhere', roster).unknown).toEqual([]);
  });

  it('counts a handle used twice once', () => {
    const v = validateMentions('@luna leaves. Later @luna returns.', ROSTER);
    expect(v.mentioned).toEqual(['luna']);
  });

  it('does not treat an email address as a mention', () => {
    const v = validateMentions('Contact luna@example.com about @luna', ROSTER);
    expect(v.mentioned).toEqual(['luna']);
    expect(v.unknown).toEqual([]);
  });

  it('lists roster handles never used, without failing on them', () => {
    const v = validateMentions('@luna alone', ROSTER);
    expect(v.missing).toEqual(['rainy-alley', 'hero-city']);
    expect(checkMentionPolicy(v, { policy: 'strict', rosterSize: 3 })).toEqual({ ok: true });
  });

  it('reports coverage over the writable roster', () => {
    expect(validateMentions('@luna and @hero-city', ROSTER).coverage).toBeCloseTo(2 / 3);
    expect(validateMentions('nobody at all', ROSTER).coverage).toBe(0);
  });

  it('keeps VOICE assets out of missing and coverage — they attach to TTS, not to prose', () => {
    const roster = [makeAsset(), makeAsset({ id: 'v1', handle: 'narrator', type: 'VOICE', name: 'Narrator' })];
    const v = validateMentions('@luna speaks', roster);
    expect(v.missing).toEqual([]);
    expect(v.coverage).toBe(1);
  });

  it('resolves a mentioned VOICE handle rather than calling it unknown, but does not let it inflate coverage', () => {
    const roster = [
      makeAsset(),
      makeAsset({ id: 'a2', handle: 'rainy-alley', type: 'LOCATION', name: 'Rainy alley' }),
      makeAsset({ id: 'v1', handle: 'narrator', type: 'VOICE', name: 'Narrator' }),
    ];
    const v = validateMentions('@luna and @narrator', roster);
    expect(v.unknown).toEqual([]);
    expect(v.coverage).toBe(0.5);
  });

  // `assetResolver` looks handles up case-sensitively, so a case mismatch does not resolve —
  // reporting it as valid here would pass a prompt that breaks downstream.
  it('treats a handle that differs only in case as unresolvable', () => {
    const v = validateMentions('@luna arrives', [makeAsset({ handle: 'Luna' })]);
    expect(v.mentioned).toEqual([]);
    expect(v.unknown).toEqual(['luna']);
  });
});

describe('checkMentionPolicy', () => {
  it('fails an unknown handle under both policies', () => {
    const v = validateMentions('@lunna waits', ROSTER);
    for (const policy of ['strict', 'lenient'] as const) {
      const result = checkMentionPolicy(v, { policy, rosterSize: 3 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('unknown-handle');
    }
  });

  it('fails strict when a non-empty roster was ignored entirely, and passes lenient', () => {
    const v = validateMentions('A courier crosses a wet alley.', ROSTER);
    const strict = checkMentionPolicy(v, { policy: 'strict', rosterSize: 3 });
    expect(strict.ok).toBe(false);
    if (!strict.ok) expect(strict.reason).toBe('no-mentions');
    expect(checkMentionPolicy(v, { policy: 'lenient', rosterSize: 3 })).toEqual({ ok: true });
  });

  it('passes strict when there was no roster to use', () => {
    const v = validateMentions('A courier crosses a wet alley.', []);
    expect(checkMentionPolicy(v, { policy: 'strict', rosterSize: 0 })).toEqual({ ok: true });
  });

  it('names the nearest handle for a one-character typo', () => {
    const v = validateMentions('@lunna waits', ROSTER);
    const result = checkMentionPolicy(v, { policy: 'lenient', rosterSize: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.feedback).toContain('Unknown handle "@lunna"');
      expect(result.feedback).toContain('closest existing handle is "@luna"');
    }
  });

  it('points a case mismatch at the correct casing', () => {
    const v = validateMentions('@luna arrives', [makeAsset({ handle: 'Luna' })]);
    const result = checkMentionPolicy(v, { policy: 'lenient', rosterSize: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.feedback).toContain('closest existing handle is "@Luna"');
  });

  it('offers no suggestion when nothing is close, and lists the real handles instead', () => {
    const v = validateMentions('@zeppelin-armada waits', ROSTER);
    const result = checkMentionPolicy(v, { policy: 'lenient', rosterSize: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.feedback).toContain('No asset in this project uses it');
      expect(result.feedback).toContain('Valid handles: @luna, @rainy-alley, @hero-city.');
    }
  });

  it('does not call a one-character handle a typo of another one-character handle', () => {
    const roster = [makeAsset({ handle: 'a' })];
    const v = validateMentions('@b waits', roster);
    const result = checkMentionPolicy(v, { policy: 'lenient', rosterSize: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.feedback).toContain('No asset in this project uses it');
  });

  it('caps the handle list so feedback stays readable', () => {
    const many = Array.from({ length: 25 }, (_, i) => makeAsset({ id: `a${i}`, handle: `handle-${i}` }));
    const v = validateMentions('@definitely-not-in-there waits', many);
    const result = checkMentionPolicy(v, { policy: 'lenient', rosterSize: many.length });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.feedback).toContain('(+5 more)');
  });

});

describe('mentionWarning', () => {
  it('says nothing when every handle resolved', () => {
    expect(mentionWarning(validateMentions('@luna enters @rainy-alley', ROSTER))).toBeNull();
  });

  it('says nothing when the text has no mentions at all', () => {
    expect(mentionWarning(validateMentions('A courier walks home', ROSTER))).toBeNull();
  });

  it('names the handle that missed and the one it probably meant', () => {
    const warning = mentionWarning(validateMentions('@lunna enters', ROSTER));
    expect(warning).toContain('@lunna');
    expect(warning).toContain('did you mean @luna?');
  });

  it('offers no suggestion when nothing is close', () => {
    const warning = mentionWarning(validateMentions('@zeppelin enters', ROSTER));
    expect(warning).toContain('@zeppelin');
    expect(warning).not.toContain('did you mean');
  });

  it('reports a case mismatch, which is what makes it unresolvable downstream', () => {
    const warning = mentionWarning(validateMentions('@Luna enters', ROSTER));
    expect(warning).toContain('@Luna');
    expect(warning).toContain('did you mean @luna?');
  });
});

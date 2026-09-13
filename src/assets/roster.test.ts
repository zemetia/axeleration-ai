import { describe, expect, it } from 'vitest';

import type { AssetVO } from '@/types/value-objects';

import { buildAssetRoster, NO_ASSETS_ROSTER } from './roster';

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

describe('buildAssetRoster', () => {
  it('tells the model plainly when there is nothing to mention', () => {
    expect(buildAssetRoster([])).toBe(NO_ASSETS_ROSTER);
  });

  it('lists one handle per asset with its type and profile', () => {
    const roster = buildAssetRoster([makeAsset(), makeAsset({ handle: 'dock', type: 'LOCATION', name: 'The dock' })]);
    expect(roster).toContain('@luna — Character: A courier with silver hair');
    expect(roster).toContain('@dock — Location:');
  });

  it('flags assets that carry a reference image, since that decides image-to-video downstream', () => {
    expect(buildAssetRoster([makeAsset({ refUrl: 'https://storage.local/luna.png' })])).toContain('[has reference image]');
  });

  it('drops VOICE assets — they attach to TTS, not to prose', () => {
    const roster = buildAssetRoster([makeAsset(), makeAsset({ handle: 'narrator', type: 'VOICE', name: 'Narrator' })]);
    expect(roster).toContain('@luna');
    expect(roster).not.toContain('@narrator');
  });

  it('returns the empty marker when the only assets are voices', () => {
    expect(buildAssetRoster([makeAsset({ type: 'VOICE' })])).toBe(NO_ASSETS_ROSTER);
  });

  it('compact mode carries names only — the pitch stage does not need look detail', () => {
    const roster = buildAssetRoster([makeAsset({ refUrl: 'https://storage.local/luna.png' })], { compact: true });
    expect(roster).toBe('@luna — Character: Luna');
  });

  it('caps the list and says how many were withheld rather than inviting guesses', () => {
    const many = Array.from({ length: 45 }, (_, i) => makeAsset({ id: `a${i}`, handle: `h${i}` }));
    const roster = buildAssetRoster(many);
    expect(roster.split('\n')).toHaveLength(41);
    expect(roster).toContain('(+5 more assets not listed — do not guess their handles)');
  });
});

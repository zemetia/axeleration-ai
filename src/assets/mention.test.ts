import { describe, expect, it } from 'vitest';

import { extractMentions, splitMentions } from './mention';

describe('extractMentions', () => {
  it('matches a mention at the start of the text', () => {
    expect(extractMentions('@luna walks into the room')).toEqual(['luna']);
  });

  it('matches a mention at the end of the text', () => {
    expect(extractMentions('the room belongs to @luna')).toEqual(['luna']);
  });

  it('matches a mention followed by punctuation', () => {
    expect(extractMentions('is that @luna, or @rainy-alley?')).toEqual(['luna', 'rainy-alley']);
  });

  it('dedupes repeated mentions, keeping first-seen order', () => {
    expect(extractMentions('@luna and @hero-city, again @luna')).toEqual(['luna', 'hero-city']);
  });

  it('does not match inside an email address', () => {
    expect(extractMentions('contact user@example.com for details')).toEqual([]);
  });

  it('matches a mention right after an open paren', () => {
    expect(extractMentions('(@luna) enters the scene')).toEqual(['luna']);
  });

  it('returns an empty array when there are no mentions', () => {
    expect(extractMentions('no handles here')).toEqual([]);
  });

  // Scanned, deliberately — resolution stays case-sensitive, so this handle still matches no asset.
  // Scanning it is what lets the validator suggest the right casing instead of saying nothing.
  it('scans a capitalised handle so it can be reported rather than ignored', () => {
    expect(extractMentions('@Luna walks in')).toEqual(['Luna']);
  });

  it('still refuses an email address whose local part is capitalised', () => {
    expect(extractMentions('contact User@Example.com')).toEqual([]);
  });
});

describe('splitMentions', () => {
  it('splits prose around a mention', () => {
    expect(splitMentions('the room belongs to @luna, still')).toEqual([
      { kind: 'text', text: 'the room belongs to ' },
      { kind: 'mention', text: '@luna', handle: 'luna' },
      { kind: 'text', text: ', still' },
    ]);
  });

  it('keeps repeated mentions instead of deduping them', () => {
    expect(splitMentions('@luna sees @luna')).toEqual([
      { kind: 'mention', text: '@luna', handle: 'luna' },
      { kind: 'text', text: ' sees ' },
      { kind: 'mention', text: '@luna', handle: 'luna' },
    ]);
  });

  it('leaves an email address as plain text', () => {
    expect(splitMentions('contact user@example.com')).toEqual([
      { kind: 'text', text: 'contact user@example.com' },
    ]);
  });

  it('returns one text segment when there are no mentions', () => {
    expect(splitMentions('no handles here')).toEqual([{ kind: 'text', text: 'no handles here' }]);
  });

  it('returns nothing for an empty string', () => {
    expect(splitMentions('')).toEqual([]);
  });

  it('reproduces the input when the segments are joined back together', () => {
    const text = '(@luna) and @rainy-alley meet at dawn — @luna leaves.';
    expect(
      splitMentions(text)
        .map((segment) => segment.text)
        .join(''),
    ).toBe(text);
  });
});

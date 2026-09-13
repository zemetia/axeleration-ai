import { describe, expect, it } from 'vitest';

import { getPath, renderHeaders, renderString, renderValue } from './template';

describe('getPath', () => {
  const response = {
    data: { task_id: 't-1', assets: [{ video_url: 'https://cdn/a.mp4' }], state: 'succeeded' },
  };

  it('reads nested keys and array indices', () => {
    expect(getPath(response, 'data.task_id')).toBe('t-1');
    expect(getPath(response, 'data.assets[0].video_url')).toBe('https://cdn/a.mp4');
    expect(getPath(response, 'data.state')).toBe('succeeded');
  });

  it('returns undefined for a missing or wrongly-typed link instead of throwing', () => {
    expect(getPath(response, 'data.nope.deeper')).toBeUndefined();
    expect(getPath(response, 'data.assets[9].video_url')).toBeUndefined();
    // `state` is a string, so indexing into it is a spec error, not a crash.
    expect(getPath(response, 'data.state.length')).toBeUndefined();
  });
});

describe('renderValue', () => {
  const vars = {
    prompt: 'a cat',
    duration: 8,
    seed: undefined,
    width: 1024,
    height: 576,
    imageUrls: ['https://cdn/1.png'],
    input: { cfg: 7.5 },
  };

  it('keeps the value type when the string is only a placeholder', () => {
    expect(renderValue('{{duration}}', vars)).toBe(8);
    expect(renderValue('{{imageUrls}}', vars)).toEqual(['https://cdn/1.png']);
    expect(renderValue('{{input.cfg}}', vars)).toBe(7.5);
  });

  it('interpolates when the placeholder is part of a longer string', () => {
    expect(renderValue('{{width}}x{{height}}', vars)).toBe('1024x576');
    expect(renderString('https://api/v2/{{prompt}}/go', vars)).toBe('https://api/v2/a cat/go');
  });

  it('drops object keys whose value resolves to undefined', () => {
    const body = renderValue(
      { model: 'm', prompt: '{{prompt}}', seed: '{{seed}}', missing: '{{nothing}}' },
      vars,
    );
    expect(body).toEqual({ model: 'm', prompt: 'a cat' });
    expect(Object.keys(body as object)).not.toContain('seed');
  });

  it('renders an unresolved inline placeholder as empty, never the text "undefined"', () => {
    expect(renderValue('prefix-{{nothing}}-suffix', vars)).toBe('prefix--suffix');
  });

  it('recurses through nested objects and arrays', () => {
    expect(
      renderValue({ outer: { list: ['{{prompt}}', '{{seed}}', { n: '{{duration}}' }] } }, vars),
    ).toEqual({ outer: { list: ['a cat', { n: 8 }] } });
  });
});

describe('renderHeaders', () => {
  it('renders values and drops the ones that came out empty', () => {
    expect(renderHeaders({ 'X-Key': '{{apiKey}}', 'X-Trace': '{{missing}}' }, { apiKey: 'k' })).toEqual({
      'X-Key': 'k',
    });
  });
});

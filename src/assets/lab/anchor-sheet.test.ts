import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The montage is the whole point of the composed anchor: a single render asked for seven panels
 * came back with two bodies and four near-identical faces, so the geometry moved here. These
 * assertions are about what the model can no longer get wrong.
 */

import type { SheetPanel } from './anchor-sheet';

// Signatures are written out rather than pulled off the modules: both are imported dynamically
// (the storage root is read once, at import time, so the env has to be set first) and the lint
// config forbids `import()` type annotations.
let composeAnchorSheet: (panels: SheetPanel[]) => Promise<{ url: string }>;
let putObject: (key: string, data: Buffer) => Promise<{ key: string; url: string }>;
let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'sheet-'));
  process.env.LOCAL_STORAGE_DIR = root;
  // Imported after the env is set: both modules resolve the storage root once, at import time.
  ({ putObject } = await import('@/lib/storage'));
  ({ composeAnchorSheet } = await import('./anchor-sheet'));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A solid-colour stand-in for a rendered panel, at the aspect that panel kind is rendered in. */
async function panel(name: string, kind: 'body' | 'face') {
  const [width, height] = kind === 'body' ? [576, 1024] : [768, 768];
  const png = await sharp({ create: { width, height, channels: 3, background: { r: 10, g: 200, b: 10 } } })
    .png()
    .toBuffer();
  const { url } = await putObject(`panels/${name}.png`, png);
  return { url, kind };
}

describe('composeAnchorSheet', () => {
  it('tiles four body panels over three face panels at one width', async () => {
    const panels = [
      await panel('b1', 'body'),
      await panel('b2', 'body'),
      await panel('b3', 'body'),
      await panel('b4', 'body'),
      await panel('f1', 'face'),
      await panel('f2', 'face'),
      await panel('f3', 'face'),
    ];

    const { url } = await composeAnchorSheet(panels);
    const key = url.slice(url.indexOf('/media/') + '/media/'.length);
    const meta = await sharp(path.join(root, key)).metadata();

    // 2304 wide: four 9:16 bodies at 576, then three squares at 768. Both rows fill the width
    // exactly, which is what keeps a gray seam from reading as a panel border.
    expect(meta.width).toBe(2304);
    expect(meta.height).toBe(1024 + 768);
  });

  it('refuses a panel that is not a stored image', async () => {
    await expect(
      composeAnchorSheet([{ url: 'https://example.com/evil.png', kind: 'body' }]),
    ).rejects.toThrow(/not a stored image/i);
  });
});

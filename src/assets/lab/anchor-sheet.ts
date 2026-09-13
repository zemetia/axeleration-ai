import sharp from 'sharp';

import { isLocalUrl, keyFromUrl, putObject, readObject } from '@/lib/storage';

/**
 * Tiles rendered panels into one reference sheet.
 *
 * The sheet used to be a single prompt asking for a seven-panel grid, and image models do not obey
 * it: the first run came back with two full bodies and four faces at the same angle. Layout is not
 * something to negotiate with a sampler when it is twenty lines of geometry here. Each panel is
 * rendered on its own — one subject, one angle, which is the thing these models actually do well —
 * and this module guarantees the count, the order and the arrangement.
 *
 * Two rows, because that is what the panel kinds mean: full-body angles across the top, face
 * close-ups underneath, both rows the same width so the sheet reads as one plate.
 */

export interface SheetPanel {
  /** Local storage URL of a rendered panel. Remote URLs are refused — see `readPanel`. */
  url: string;
  kind: 'body' | 'face';
}

/** Row width in pixels. Four 9:16 body panels at 576 wide land exactly on it. */
const SHEET_WIDTH = 2304;

/** The "plain flat gray background" the panels are prompted for, so letterboxing is invisible. */
const GRAY = { r: 138, g: 138, b: 138, alpha: 1 };

interface Cell {
  panel: SheetPanel;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Splits the row into equal cells, giving the last one the rounding remainder.
 *
 * Floor-then-fix rather than round-each: three cells of `floor(2304/3)` leave a 2px gray seam down
 * the right edge, and a seam on a reference sheet reads as a border the video model has to ignore.
 */
function layoutRow(panels: SheetPanel[], top: number, height: number): Cell[] {
  const width = Math.floor(SHEET_WIDTH / panels.length);
  return panels.map((panel, index) => ({
    panel,
    top,
    height,
    left: index * width,
    width: index === panels.length - 1 ? SHEET_WIDTH - index * width : width,
  }));
}

async function readPanel(url: string): Promise<Buffer> {
  // The URLs arrive over HTTP from the browser. Fetching an arbitrary one here would turn this
  // route into a request forwarder for anything the server can reach, so only keys this app wrote
  // are accepted — provider outputs are downloaded into storage before they ever reach a client.
  if (!isLocalUrl(url)) throw new Error(`Panel is not a stored image: ${url}`);
  return readObject(keyFromUrl(url));
}

/**
 * Composes the sheet and stores it. Panels keep the order they are given — the caller owns the
 * sheet's reading order, this owns its geometry.
 */
export async function composeAnchorSheet(panels: SheetPanel[]): Promise<{ url: string }> {
  if (panels.length === 0) throw new Error('A sheet needs at least one panel');

  const bodies = panels.filter((panel) => panel.kind === 'body');
  const faces = panels.filter((panel) => panel.kind === 'face');

  // 9:16 for the body row, square for the faces — the aspect each panel was rendered at, so
  // `contain` letterboxes by a hair rather than stranding a figure in a field of gray.
  const bodyHeight = bodies.length > 0 ? Math.round((SHEET_WIDTH / bodies.length) * (16 / 9)) : 0;
  const faceHeight = faces.length > 0 ? Math.round(SHEET_WIDTH / faces.length) : 0;

  const cells = [
    ...layoutRow(bodies, 0, bodyHeight),
    ...layoutRow(faces, bodyHeight, faceHeight),
  ];
  const height = bodyHeight + faceHeight;

  const composites = await Promise.all(
    cells.map(async (cell) => ({
      left: cell.left,
      top: cell.top,
      input: await sharp(await readPanel(cell.panel.url))
        .resize(cell.width, cell.height, { fit: 'contain', background: GRAY })
        .toBuffer(),
    })),
  );

  const sheet = await sharp({
    create: { width: SHEET_WIDTH, height, channels: 3, background: GRAY },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return putObject(
    `assets/sheets/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`,
    sheet,
  );
}

import { buildAssetProfile } from '@/assets/profile';
import { assetFieldOf } from '@/config/asset-schema';
import type { AnchorPanel, AssetView } from '@/config/asset-views';
import type { AssetAttributes } from '@/lib/validations';
import type { AssetType } from '@prisma/client';

/**
 * Builds one view's image prompt.
 *
 * Deliberately deterministic — no LLM pass. The asset's own fields are already the description
 * (that is what `buildAssetProfile` exists for), and putting a model between them and the image
 * would add a call, a cost and a source of drift to every single shot on the sheet. The AI's job in
 * the lab is upstream: turning the user's base prompt into those fields once, where it can be read
 * and corrected before anything is rendered.
 *
 * Order matters and is the same every time: subject → identity profile → view directive → style →
 * continuity. Image models weight the head of the prompt most heavily, and the subject line is what
 * must never be traded away for a camera instruction.
 */

export interface ComposeShotInput {
  type: AssetType;
  name: string;
  description?: string;
  attributes: AssetAttributes;
  view: AssetView;
  /**
   * One cell of a composed view. When set, this render is that cell alone: the panel's directive
   * replaces the view's, and the view's own subject line (which announces a grid) is dropped —
   * the layout is our job, not the model's.
   */
  panel?: AnchorPanel;
  /** Rendered profile of the STYLE asset this sheet inherits, if the user picked one. */
  styleText?: string;
  /** The user's own sentence. Kept as an intent line when it says something the fields do not. */
  basePrompt?: string;
}

export interface ComposedShot {
  prompt: string;
  negativePrompt?: string;
}

const TYPE_SUBJECT: Record<AssetType, string> = {
  CHARACTER: 'Character reference sheet image',
  PERSON: 'Photographic reference of a real person',
  STYLE: 'Visual style reference plate',
  LOCATION: 'Location reference image',
  AMBIENCE: 'Atmosphere reference plate',
  MAP: 'Cartographic illustration',
  PROP: 'Object reference image',
  VOICE: 'Reference image',
};

/** Baseline negatives every sheet wants; the asset's own `avoid` field is appended to them. */
const BASE_NEGATIVE = 'text, watermark, signature, logo, extra limbs, deformed hands, blurry, lowres, jpeg artifacts, duplicate subject';

/** A panel is tiled into a sheet afterwards, so anything grid-shaped inside it ruins the montage. */
const PANEL_NEGATIVE =
  'grid, collage, contact sheet, multiple panels, split screen, side-by-side views, two subjects, inset picture, frame border, caption';

function clause(value: string | string[] | undefined): string {
  if (!value) return '';
  return (Array.isArray(value) ? value.join(', ') : value).trim();
}

export function composeShotPrompt(input: ComposeShotInput): ComposedShot {
  const profile = buildAssetProfile({
    type: input.type,
    name: input.name,
    description: input.description ?? null,
    attributes: input.attributes,
  });

  // A view may own its subject line — see `AssetView.subject`. A panel never does: it is one
  // ordinary image of the subject, which is the only thing image models are reliably good at.
  const subject = input.panel ? TYPE_SUBJECT[input.type] : (input.view.subject ?? TYPE_SUBJECT[input.type]);
  const directive = input.panel?.directive ?? input.view.directive;
  const parts = [`${subject} of "${input.name}".`, profile, directive];

  // The base prompt is the user's own words. It is appended rather than led with, because by the
  // time a shot is composed the fields *are* the expanded version of it — but a lab run where the
  // user never opened the fields would otherwise lose everything they typed.
  const base = input.basePrompt?.trim();
  if (base && !profile.toLowerCase().includes(base.toLowerCase())) {
    parts.push(`Original intent: ${base}`);
  }

  const style = input.styleText?.trim();
  if (style) parts.push(`Rendered in this visual style: ${style}`);

  // `mustKeep` is the continuity lock — last position, where an image model reads it as the final
  // constraint rather than as one more descriptive clause.
  const mustKeep = assetFieldOf(input.type, 'mustKeep') ? clause(input.attributes.mustKeep) : '';
  if (mustKeep) parts.push(`Must remain identical in every image: ${mustKeep}.`);

  // Three sources, widest first: the sheet-wide baseline, what this angle in particular gets wrong,
  // then the asset's own two fields — `avoid` (prose: what must never be depicted) and
  // `negativePrompt` (raw tokens the user writes for the image model directly).
  const negatives = [
    BASE_NEGATIVE,
    // A panel that comes back as its own little grid cannot be tiled into one.
    input.panel ? PANEL_NEGATIVE : input.view.negative,
    assetFieldOf(input.type, 'avoid') ? clause(input.attributes.avoid) : '',
    assetFieldOf(input.type, 'negativePrompt') ? clause(input.attributes.negativePrompt) : '',
  ];

  return {
    prompt: parts.filter(Boolean).join('\n\n'),
    negativePrompt: dedupeTerms(negatives.filter(Boolean).join(', ')),
  };
}

/**
 * Four sources overlap by design — "extra fingers" is a sensible thing for a user to type even
 * though the baseline already has it. Repeating a term does not weight it higher on any provider
 * worth using, it just spends tokens, so the first occurrence wins and the rest are dropped.
 */
function dedupeTerms(list: string): string {
  const seen = new Set<string>();
  return list
    .split(',')
    .map((term) => term.trim())
    .filter((term) => {
      const key = term.toLowerCase();
      if (!term || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}

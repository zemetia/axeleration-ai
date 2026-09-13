import type { AssetType } from '@prisma/client';

/**
 * Per-type attribute schema for the asset library.
 *
 * Every asset carries a free-text `description` (the canonical prompt line), but a character
 * needs personality and a map needs a projection — asking for the same three fields for both
 * makes the library useless. These definitions drive three things at once: the editor form,
 * the detail panel, and the prompt text `buildAssetProfile()` injects when the asset is
 * @mentioned. Add a field here and all three follow — never hardcode field lists in a component.
 *
 * Values are stored in `Asset.metadata` keyed by `AssetField.key`.
 */

export type AssetFieldKind = 'text' | 'textarea' | 'select' | 'tags';

export interface AssetField {
  key: string;
  label: string;
  kind: AssetFieldKind;
  hint?: string;
  placeholder?: string;
  /** `select` only — the first entry is always rendered as an empty "not specified" option. */
  options?: readonly string[];
  /** `tags` only — one-click suggestions; users can always type their own. */
  suggestions?: readonly string[];
  rows?: number;
  /** Field spans both columns in the editor grid. Defaults to true for textarea/tags. */
  wide?: boolean;
  /**
   * The value is a negative instruction and must never reach a positive prompt — the image model
   * would render exactly what it lists. `buildAssetProfile()` skips these; the lab folds them into
   * `negativePrompt` instead.
   */
  negativeOnly?: boolean;
}

export interface AssetSection {
  id: string;
  title: string;
  description?: string;
  fields: readonly AssetField[];
}

export interface AssetReferenceSpec {
  kind: 'image' | 'audio';
  label: string;
  hint: string;
  accept: string;
}

export interface AssetTypeSchema {
  type: AssetType;
  label: string;
  /** One line explaining when to reach for this type. Shown in the type picker. */
  tagline: string;
  handleExample: string;
  reference: AssetReferenceSpec;
  sections: readonly AssetSection[];
  /** Attribute keys surfaced as chips on the grid card, in order. */
  highlightKeys: readonly string[];
}

const IMAGE_REFERENCE: AssetReferenceSpec = {
  kind: 'image',
  label: 'Reference image',
  hint: 'Sent to the image/video model alongside the prompt — the single strongest consistency lever.',
  accept: 'image/*',
};

/**
 * The raw negative-prompt box, offered on every type the lab renders images for.
 *
 * Distinct from `avoid` on purpose: `avoid` is prose about the asset ("never depict them
 * endorsing a product") and stays in the positive profile because the script and dialogue stages
 * need to read it. This one is comma-separated tokens aimed at the image model, and is the only
 * field that is negative-only.
 */
const NEGATIVE_PROMPT_FIELD: AssetField = {
  key: 'negativePrompt',
  label: 'Negative prompt',
  kind: 'textarea',
  rows: 2,
  negativeOnly: true,
  hint: 'Comma-separated tokens sent to the image model as negatives. Added to the built-in baseline, never shown to it as description.',
  placeholder: 'extra fingers, blurry, mismatched hairstyle',
};

/** Shared closing section: every visual type benefits from an explicit keep/avoid pair. */
function continuitySection(keepHint: string): AssetSection {
  return {
    id: 'continuity',
    title: 'Continuity',
    description: 'Locks the details that must survive every regeneration.',
    fields: [
      {
        key: 'mustKeep',
        label: 'Must keep',
        kind: 'textarea',
        rows: 2,
        hint: keepHint,
        placeholder: 'Details that must never change between shots',
      },
      {
        key: 'avoid',
        label: 'Avoid',
        kind: 'textarea',
        rows: 2,
        hint: 'Appended as a negative instruction.',
        placeholder: 'Never show…',
      },
      NEGATIVE_PROMPT_FIELD,
    ],
  };
}

const CHARACTER_SCHEMA: AssetTypeSchema = {
  type: 'CHARACTER',
  label: 'Character',
  tagline: 'A fictional cast member — needs looks, personality, and voice direction.',
  handleExample: 'luna',
  reference: IMAGE_REFERENCE,
  highlightKeys: ['role', 'age', 'traits'],
  sections: [
    {
      id: 'identity',
      title: 'Identity',
      fields: [
        {
          key: 'role',
          label: 'Story role',
          kind: 'select',
          options: ['Protagonist', 'Antagonist', 'Supporting', 'Narrator', 'Mentor', 'Comic relief', 'Cameo'],
        },
        { key: 'age', label: 'Age', kind: 'text', placeholder: '17 / late thirties' },
        { key: 'gender', label: 'Gender', kind: 'text', placeholder: 'Female / non-binary' },
        { key: 'species', label: 'Species / kind', kind: 'text', placeholder: 'Human, elf, android…' },
        { key: 'occupation', label: 'Occupation', kind: 'text', placeholder: 'Archivist, street racer…' },
        { key: 'pronouns', label: 'Pronouns', kind: 'text', placeholder: 'she/her' },
      ],
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'What the image model has to reproduce shot after shot.',
      fields: [
        { key: 'build', label: 'Build & height', kind: 'text', placeholder: 'Slight, 160cm' },
        { key: 'hair', label: 'Hair', kind: 'text', placeholder: 'Silver, shoulder-length, blunt fringe' },
        { key: 'eyes', label: 'Eyes', kind: 'text', placeholder: 'Amber, heavy lids' },
        { key: 'skin', label: 'Skin', kind: 'text', placeholder: 'Warm brown, freckled' },
        {
          key: 'outfit',
          label: 'Signature outfit',
          kind: 'textarea',
          rows: 2,
          placeholder: 'Red scarf, patched flight jacket, worn boots',
        },
        {
          key: 'marks',
          label: 'Distinguishing marks',
          kind: 'textarea',
          rows: 2,
          placeholder: 'Crescent scar on the left cheek',
        },
      ],
    },
    {
      id: 'personality',
      title: 'Personality',
      description: 'Drives how the script writes their dialogue and reactions.',
      fields: [
        {
          key: 'traits',
          label: 'Traits',
          kind: 'tags',
          suggestions: ['brave', 'impulsive', 'loyal', 'guarded', 'sarcastic', 'gentle', 'ruthless', 'curious'],
          hint: 'Three to six adjectives is the sweet spot.',
        },
        {
          key: 'temperament',
          label: 'Temperament',
          kind: 'select',
          options: ['Warm', 'Cold', 'Volatile', 'Steady', 'Playful', 'Withdrawn', 'Commanding'],
        },
        { key: 'motivation', label: 'Wants', kind: 'textarea', rows: 2, placeholder: 'What drives them right now' },
        { key: 'fear', label: 'Fears', kind: 'textarea', rows: 2, placeholder: 'What they refuse to face' },
        {
          key: 'quirks',
          label: 'Quirks & habits',
          kind: 'tags',
          suggestions: ['taps two fingers', 'never sits still', 'hums when nervous'],
        },
      ],
    },
    {
      id: 'voice',
      title: 'Voice & speech',
      fields: [
        { key: 'speechStyle', label: 'Speech style', kind: 'text', placeholder: 'Clipped, deflects with jokes' },
        { key: 'accent', label: 'Accent', kind: 'text', placeholder: 'Coastal drawl' },
        { key: 'catchphrase', label: 'Catchphrases', kind: 'tags' },
        {
          key: 'voiceHandle',
          label: 'Linked voice asset',
          kind: 'text',
          hint: 'Handle of a VOICE asset, e.g. luna-voice.',
          placeholder: 'luna-voice',
        },
      ],
    },
    {
      id: 'story',
      title: 'Story',
      fields: [
        { key: 'backstory', label: 'Backstory', kind: 'textarea', rows: 3 },
        {
          key: 'relationships',
          label: 'Relationships',
          kind: 'textarea',
          rows: 2,
          hint: '@mention other characters here.',
          placeholder: 'Younger sister of @kai; distrusts @warden',
        },
        { key: 'arc', label: 'Arc notes', kind: 'textarea', rows: 2 },
      ],
    },
    continuitySection('Face, hair and wardrobe details that identify them at a glance.'),
  ],
};

const PERSON_SCHEMA: AssetTypeSchema = {
  type: 'PERSON',
  label: 'Person',
  tagline: 'A real human — host, actor, or yourself. Likeness and consent matter here.',
  handleExample: 'host-rara',
  reference: {
    ...IMAGE_REFERENCE,
    hint: 'A clear, well-lit face reference. Only upload people who have agreed to appear.',
  },
  highlightKeys: ['projectRole', 'demeanor'],
  sections: [
    {
      id: 'identity',
      title: 'Identity',
      fields: [
        { key: 'fullName', label: 'Full name', kind: 'text' },
        { key: 'projectRole', label: 'Role in this project', kind: 'text', placeholder: 'Host, narrator, guest' },
        { key: 'ageRange', label: 'Age range', kind: 'text', placeholder: '30s' },
        { key: 'pronouns', label: 'Pronouns', kind: 'text', placeholder: 'they/them' },
      ],
    },
    {
      id: 'appearance',
      title: 'Appearance',
      fields: [
        { key: 'appearance', label: 'Appearance notes', kind: 'textarea', rows: 3 },
        { key: 'wardrobe', label: 'Usual wardrobe', kind: 'textarea', rows: 2 },
        { key: 'grooming', label: 'Hair & grooming', kind: 'text' },
      ],
    },
    {
      id: 'presence',
      title: 'On-camera presence',
      fields: [
        {
          key: 'demeanor',
          label: 'Demeanor',
          kind: 'select',
          options: ['Warm', 'Authoritative', 'Casual', 'High energy', 'Deadpan', 'Analytical'],
        },
        { key: 'speakingStyle', label: 'Speaking style', kind: 'text', placeholder: 'Fast, lots of hand gestures' },
        { key: 'language', label: 'Language', kind: 'text', placeholder: 'Indonesian, some English' },
      ],
    },
    {
      id: 'rights',
      title: 'Usage & rights',
      description: 'Real-likeness assets carry obligations — write them down.',
      fields: [
        {
          key: 'consent',
          label: 'Consent / usage notes',
          kind: 'textarea',
          rows: 2,
          placeholder: 'Written consent on file for episodes 1–10',
        },
        { key: 'avoid', label: 'Avoid', kind: 'textarea', rows: 2, placeholder: 'Never depict endorsing a product' },
        NEGATIVE_PROMPT_FIELD,
      ],
    },
  ],
};

const STYLE_SCHEMA: AssetTypeSchema = {
  type: 'STYLE',
  label: 'Style',
  tagline: 'The visual language of the whole project — medium, palette, camera.',
  handleExample: 'house-look',
  reference: { ...IMAGE_REFERENCE, hint: 'A still that nails the look. Style transfer keys off this image.' },
  highlightKeys: ['medium', 'palette', 'lighting'],
  sections: [
    {
      id: 'look',
      title: 'Look',
      fields: [
        {
          key: 'medium',
          label: 'Medium',
          kind: 'select',
          options: [
            'Photoreal',
            '3D render',
            '2D anime',
            'Western cartoon',
            'Watercolour',
            'Oil painting',
            'Comic / ink',
            'Claymation',
            'Pixel art',
            'Collage',
          ],
        },
        { key: 'artDirection', label: 'Art direction', kind: 'textarea', rows: 3, placeholder: 'Soft-edged…' },
        { key: 'era', label: 'Era / influence', kind: 'text', placeholder: '90s cel anime, Studio Ghibli' },
        { key: 'texture', label: 'Texture & finish', kind: 'text', placeholder: 'Grain, halation, paper tooth' },
      ],
    },
    {
      id: 'color',
      title: 'Colour & light',
      fields: [
        {
          key: 'palette',
          label: 'Palette',
          kind: 'tags',
          suggestions: ['teal', 'amber', 'desaturated', 'high contrast', 'pastel', 'neon', 'earth tones'],
        },
        { key: 'lighting', label: 'Lighting', kind: 'text', placeholder: 'Low-key, single warm key light' },
        {
          key: 'mood',
          label: 'Mood',
          kind: 'select',
          options: ['Bright', 'Cosy', 'Melancholic', 'Tense', 'Dreamlike', 'Gritty', 'Epic'],
        },
      ],
    },
    {
      id: 'camera',
      title: 'Camera',
      fields: [
        { key: 'lens', label: 'Lens & depth', kind: 'text', placeholder: '35mm, shallow depth of field' },
        { key: 'framing', label: 'Framing tendencies', kind: 'text', placeholder: 'Centred, generous headroom' },
        { key: 'motion', label: 'Camera motion', kind: 'text', placeholder: 'Slow push-in, handheld drift' },
        { key: 'aspectNotes', label: 'Composition notes', kind: 'text', placeholder: 'Safe margins for captions' },
      ],
    },
    continuitySection('The traits that make two shots read as the same production.'),
  ],
};

const LOCATION_SCHEMA: AssetTypeSchema = {
  type: 'LOCATION',
  label: 'Location',
  tagline: 'A place scenes return to — architecture, landmarks, and its usual weather.',
  handleExample: 'rainy-alley',
  reference: IMAGE_REFERENCE,
  highlightKeys: ['setting', 'timeOfDay', 'weather'],
  sections: [
    {
      id: 'place',
      title: 'Place',
      fields: [
        {
          key: 'setting',
          label: 'Interior / exterior',
          kind: 'select',
          options: ['Interior', 'Exterior', 'Both'],
        },
        { key: 'region', label: 'Region / world', kind: 'text', placeholder: 'Coastal Jakarta, 2140' },
        { key: 'era', label: 'Era', kind: 'text', placeholder: 'Near future' },
        { key: 'scale', label: 'Scale', kind: 'text', placeholder: 'Two-lane alley, four storeys high' },
      ],
    },
    {
      id: 'look',
      title: 'Look',
      fields: [
        { key: 'architecture', label: 'Architecture & materials', kind: 'textarea', rows: 2 },
        {
          key: 'landmarks',
          label: 'Key landmarks & props',
          kind: 'textarea',
          rows: 2,
          placeholder: 'Neon noodle sign, dripping AC units, red door at the end',
        },
        { key: 'vegetation', label: 'Vegetation & ground', kind: 'text' },
      ],
    },
    {
      id: 'atmosphere',
      title: 'Atmosphere',
      fields: [
        {
          key: 'timeOfDay',
          label: 'Time of day',
          kind: 'select',
          options: ['Dawn', 'Morning', 'Midday', 'Golden hour', 'Dusk', 'Night', 'Varies'],
        },
        {
          key: 'weather',
          label: 'Weather',
          kind: 'select',
          options: ['Clear', 'Overcast', 'Rain', 'Storm', 'Fog', 'Snow', 'Heatwave', 'Varies'],
        },
        { key: 'ambientSound', label: 'Ambient sound', kind: 'text', placeholder: 'Rain on metal, distant traffic' },
        {
          key: 'mood',
          label: 'Mood',
          kind: 'tags',
          suggestions: ['lonely', 'claustrophobic', 'safe', 'sacred', 'hostile', 'nostalgic'],
        },
      ],
    },
    continuitySection('Landmarks and layout that must match across every scene set here.'),
  ],
};

const MAP_SCHEMA: AssetTypeSchema = {
  type: 'MAP',
  label: 'Map',
  tagline: 'Geography of your world — regions, routes, and how they are drawn.',
  handleExample: 'world-map',
  reference: { ...IMAGE_REFERENCE, hint: 'An existing map render or sketch to keep geography consistent.' },
  highlightKeys: ['mapKind', 'perspective', 'terrain'],
  sections: [
    {
      id: 'overview',
      title: 'Overview',
      fields: [
        {
          key: 'mapKind',
          label: 'Map kind',
          kind: 'select',
          options: ['World', 'Region', 'City', 'Building floorplan', 'Route', 'Schematic', 'Star chart'],
        },
        {
          key: 'perspective',
          label: 'Perspective',
          kind: 'select',
          options: ['Top-down', 'Isometric', 'Three-quarter', 'Hand-drawn panorama'],
        },
        { key: 'scale', label: 'Scale', kind: 'text', placeholder: '1 tile = 10km' },
        { key: 'orientation', label: 'Orientation', kind: 'text', placeholder: 'North up' },
      ],
    },
    {
      id: 'geography',
      title: 'Geography',
      fields: [
        {
          key: 'terrain',
          label: 'Terrain',
          kind: 'tags',
          suggestions: ['mountains', 'desert', 'rainforest', 'archipelago', 'tundra', 'wetland', 'ruins'],
        },
        {
          key: 'regions',
          label: 'Regions & zones',
          kind: 'textarea',
          rows: 3,
          placeholder: 'North: frozen shelf. Centre: the Ash Basin…',
        },
        { key: 'landmarks', label: 'Landmarks', kind: 'textarea', rows: 2 },
        { key: 'routes', label: 'Routes & borders', kind: 'textarea', rows: 2 },
      ],
    },
    {
      id: 'cartography',
      title: 'Cartography',
      description: 'How the map is drawn, as opposed to what it shows.',
      fields: [
        { key: 'labelStyle', label: 'Labels & legend', kind: 'text', placeholder: 'Serif labels, compass rose' },
        {
          key: 'colorScheme',
          label: 'Colour scheme',
          kind: 'tags',
          suggestions: ['parchment', 'muted greens', 'ink on white', 'satellite'],
        },
        { key: 'annotations', label: 'Annotations', kind: 'textarea', rows: 2 },
      ],
    },
    {
      id: 'usage',
      title: 'Usage',
      fields: [
        { key: 'purpose', label: 'Purpose in the story', kind: 'textarea', rows: 2 },
        { key: 'avoid', label: 'Avoid', kind: 'textarea', rows: 2 },
        NEGATIVE_PROMPT_FIELD,
      ],
    },
  ],
};

const PROP_SCHEMA: AssetTypeSchema = {
  type: 'PROP',
  label: 'Prop',
  tagline: 'An object that recurs on screen — shape, material, and the states it appears in.',
  handleExample: 'brass-compass',
  reference: IMAGE_REFERENCE,
  highlightKeys: ['category', 'material', 'condition'],
  sections: [
    {
      id: 'object',
      title: 'Object',
      fields: [
        { key: 'category', label: 'Category', kind: 'text', placeholder: 'Weapon, vehicle, heirloom…' },
        { key: 'size', label: 'Size & scale', kind: 'text', placeholder: 'Palm-sized' },
        {
          key: 'material',
          label: 'Material',
          kind: 'tags',
          suggestions: ['brass', 'worn leather', 'matte plastic', 'glass', 'carved wood', 'steel'],
        },
        {
          key: 'condition',
          label: 'Condition',
          kind: 'select',
          options: ['Pristine', 'Well used', 'Weathered', 'Damaged', 'Ancient'],
        },
      ],
    },
    {
      id: 'look',
      title: 'Look',
      fields: [
        { key: 'silhouette', label: 'Shape & silhouette', kind: 'textarea', rows: 2 },
        { key: 'finish', label: 'Colour & finish', kind: 'text' },
        { key: 'markings', label: 'Markings & details', kind: 'textarea', rows: 2, placeholder: 'Engraved initials' },
      ],
    },
    {
      id: 'behaviour',
      title: 'Behaviour',
      fields: [
        { key: 'function', label: 'What it does', kind: 'textarea', rows: 2 },
        {
          key: 'states',
          label: 'States',
          kind: 'tags',
          hint: 'Distinct on-screen variants worth naming.',
          suggestions: ['open', 'closed', 'lit', 'broken', 'stowed'],
        },
        { key: 'owner', label: 'Who carries it', kind: 'text', placeholder: '@luna' },
      ],
    },
    continuitySection('Details that identify this exact object rather than one like it.'),
  ],
};

const AMBIENCE_SCHEMA: AssetTypeSchema = {
  type: 'AMBIENCE',
  label: 'Ambience',
  tagline: 'A mood — weather, light and sound bed applied on top of any location.',
  handleExample: 'storm-dusk',
  reference: { ...IMAGE_REFERENCE, hint: 'A mood frame: the light and weather you want, subject irrelevant.' },
  highlightKeys: ['timeOfDay', 'weather', 'mood'],
  sections: [
    {
      id: 'conditions',
      title: 'Conditions',
      fields: [
        {
          key: 'timeOfDay',
          label: 'Time of day',
          kind: 'select',
          options: ['Dawn', 'Morning', 'Midday', 'Golden hour', 'Dusk', 'Night', 'Deep night'],
        },
        {
          key: 'weather',
          label: 'Weather',
          kind: 'select',
          options: ['Clear', 'Overcast', 'Drizzle', 'Downpour', 'Storm', 'Fog', 'Snow', 'Dust'],
        },
        { key: 'season', label: 'Season', kind: 'text', placeholder: 'Late monsoon' },
        { key: 'temperature', label: 'Temperature read', kind: 'text', placeholder: 'Cold enough to see breath' },
      ],
    },
    {
      id: 'light',
      title: 'Light & air',
      fields: [
        { key: 'lighting', label: 'Lighting', kind: 'textarea', rows: 2, placeholder: 'Low sun through cloud break' },
        {
          key: 'palette',
          label: 'Colour cast',
          kind: 'tags',
          suggestions: ['cold blue', 'sodium orange', 'grey wash', 'gold', 'sickly green'],
        },
        { key: 'atmospherics', label: 'Atmospherics', kind: 'text', placeholder: 'Haze, god rays, drifting embers' },
      ],
    },
    {
      id: 'sound',
      title: 'Sound bed',
      description: 'Feeds the music and sound stages, not the image model.',
      fields: [
        { key: 'ambientSound', label: 'Ambient sound', kind: 'textarea', rows: 2, placeholder: 'Rain, far thunder' },
        {
          key: 'mood',
          label: 'Emotional read',
          kind: 'tags',
          suggestions: ['ominous', 'peaceful', 'restless', 'lonely', 'triumphant', 'oppressive'],
        },
        { key: 'musicCue', label: 'Music cue', kind: 'text', placeholder: 'Sparse piano, low drone' },
      ],
    },
    continuitySection('The two or three cues that define this mood wherever it is applied.'),
  ],
};

const VOICE_SCHEMA: AssetTypeSchema = {
  type: 'VOICE',
  label: 'Voice',
  tagline: 'A speaking voice for narration or dialogue — provider id plus delivery direction.',
  handleExample: 'luna-voice',
  reference: {
    kind: 'audio',
    label: 'Reference audio',
    hint: 'A clean 10–30s sample. Used for cloning or as a delivery reference.',
    accept: 'audio/*',
  },
  highlightKeys: ['language', 'tone', 'pace'],
  sections: [
    {
      id: 'voice',
      title: 'Voice',
      fields: [
        { key: 'language', label: 'Language & accent', kind: 'text', placeholder: 'Indonesian, Jakarta accent' },
        { key: 'genderPresentation', label: 'Gender presentation', kind: 'text', placeholder: 'Feminine' },
        { key: 'ageImpression', label: 'Sounds like age', kind: 'text', placeholder: 'Late twenties' },
        { key: 'timbre', label: 'Timbre', kind: 'text', placeholder: 'Warm, slight rasp' },
      ],
    },
    {
      id: 'delivery',
      title: 'Delivery',
      fields: [
        {
          key: 'tone',
          label: 'Tone',
          kind: 'select',
          options: ['Conversational', 'Authoritative', 'Intimate', 'Upbeat', 'Sombre', 'Documentary'],
        },
        { key: 'pace', label: 'Pace', kind: 'select', options: ['Slow', 'Measured', 'Brisk', 'Rapid'] },
        {
          key: 'energy',
          label: 'Energy',
          kind: 'select',
          options: ['Low', 'Relaxed', 'Engaged', 'High', 'Explosive'],
        },
        {
          key: 'emotionRange',
          label: 'Emotional range',
          kind: 'tags',
          suggestions: ['deadpan', 'wry', 'tender', 'urgent', 'weary'],
        },
      ],
    },
    {
      id: 'direction',
      title: 'Direction',
      fields: [
        {
          key: 'pronunciation',
          label: 'Pronunciation notes',
          kind: 'textarea',
          rows: 2,
          placeholder: 'Say "Axeleration" as ax-el-eration',
        },
        { key: 'pauses', label: 'Phrasing & pauses', kind: 'text', placeholder: 'Beat before each question' },
        { key: 'avoid', label: 'Avoid', kind: 'textarea', rows: 2, placeholder: 'No shouting, no vocal fry' },
      ],
    },
  ],
};

export const ASSET_TYPE_SCHEMAS: Record<AssetType, AssetTypeSchema> = {
  CHARACTER: CHARACTER_SCHEMA,
  PERSON: PERSON_SCHEMA,
  STYLE: STYLE_SCHEMA,
  LOCATION: LOCATION_SCHEMA,
  MAP: MAP_SCHEMA,
  PROP: PROP_SCHEMA,
  AMBIENCE: AMBIENCE_SCHEMA,
  VOICE: VOICE_SCHEMA,
};

/** Display order — visual reference types first, voice last. */
export const ASSET_TYPES: readonly AssetType[] = [
  'CHARACTER',
  'PERSON',
  'STYLE',
  'LOCATION',
  'AMBIENCE',
  'MAP',
  'PROP',
  'VOICE',
];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  CHARACTER: 'Character',
  PERSON: 'Person',
  STYLE: 'Style',
  LOCATION: 'Location',
  MAP: 'Map',
  PROP: 'Prop',
  AMBIENCE: 'Ambience',
  VOICE: 'Voice',
};

export function assetSchemaOf(type: AssetType): AssetTypeSchema {
  return ASSET_TYPE_SCHEMAS[type];
}

/** Flat field list for a type — used for validation and prompt building. */
export function assetFieldsOf(type: AssetType): readonly AssetField[] {
  return ASSET_TYPE_SCHEMAS[type].sections.flatMap((section) => section.fields);
}

export function assetFieldOf(type: AssetType, key: string): AssetField | undefined {
  return assetFieldsOf(type).find((field) => field.key === key);
}

/** A field occupies the full editor row when it is prose or a chip list. */
export function isWideField(field: AssetField): boolean {
  return field.wide ?? (field.kind === 'textarea' || field.kind === 'tags');
}

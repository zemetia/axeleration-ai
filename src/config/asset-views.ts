import type { AssetType } from '@prisma/client';

/**
 * What the asset lab renders, per type.
 *
 * `asset-schema.ts` says what an asset *is*; this file says how it must be *photographed*. A
 * character needs a turnaround (front, three-quarter, profile, back) before an image-to-video model
 * can hold their face across shots; a location needs an establishing wide and a reverse angle; a
 * prop needs orthographic faces and a scale shot. Asking for the same four angles for all of them
 * would produce a pretty sheet that solves none of those problems.
 *
 * Each view contributes one `directive` — the camera/framing clause appended to the asset profile
 * when its shot prompt is composed (`src/assets/lab/compose.ts`). Add a view here and the lab's
 * plan, its cost forecast and the contact sheet all follow.
 */

export type ShotAspect = '1:1' | '16:9' | '9:16';

/**
 * One cell of a composed sheet.
 *
 * A panel is rendered as its own ordinary single-subject image and the sheet is assembled from the
 * results (`src/assets/lab/anchor-sheet.ts`). Asking one render for a seven-panel grid is asking
 * the model to do layout, and layout is the first thing it drops: the observed failure was two
 * full bodies and four near-identical faces. Rendering the panels separately makes the count and
 * the angles a property of our code rather than a hope about the model's.
 */
export interface AnchorPanel {
  id: string;
  label: string;
  /** Row assignment and aspect: `body` panels are tall (9:16), `face` panels square. */
  kind: 'body' | 'face';
  directive: string;
}

export interface AssetView {
  id: string;
  label: string;
  /** One line telling the user what this angle is *for* — not what it looks like. */
  purpose: string;
  /** Camera, framing and pose clause appended to the profile. Written as an instruction to the image model. */
  directive: string;
  aspect: ShotAspect;
  /**
   * Replaces the type's default subject line. A view only needs this when its *layout* is the
   * thing the model must obey first — a multi-panel sheet has to announce itself before any
   * description, or the model renders one of the panels instead of the grid.
   */
  subject?: string;
  /** Negatives that only make sense for this view, appended to the sheet-wide baseline. */
  negative?: string;
  /**
   * Present on composed views: the cells are rendered one by one and stitched, so this view costs
   * `panels.length` images rather than one. `directive` still describes the finished sheet — it is
   * what the user copies to reproduce it elsewhere.
   */
  panels?: readonly AnchorPanel[];
  /** Selected when the lab opens. The rest are opt-in so a first run stays cheap. */
  defaultOn?: boolean;
  /**
   * This view establishes the asset's identity, so it is generated first and — once locked — used
   * as the reference image for every other view. Exactly one per type.
   */
  isAnchor?: boolean;
}

export interface AssetViewPlan {
  type: AssetType;
  /** Shown above the plan: why this particular set of angles. */
  rationale: string;
  views: readonly AssetView[];
}

/** Shared tail: the lab renders reference sheets, not finished frames. */
const SHEET_RULES =
  'Single subject, clean neutral background, even studio lighting, no text, no watermark, no collage borders.';

/**
 * The anchor is one image containing seven panels, not one portrait.
 *
 * A head-and-shoulders anchor locks a face and nothing else, so the first full-body angle
 * generated against it invents the silhouette, the outfit and the back of the head — and every
 * later shot inherits that invention. A turnaround sheet decides all of it in a single render,
 * which is also the cheapest possible way to buy consistency: one image-to-image reference that
 * already answers "what does the back of this character look like".
 */
const ANCHOR_SHEET_PANELS = `Full body panels:
1. Front view, A-pose
2. Left side view
3. Back view
4. 3/4 view

Face close-up panels:
5. Front face, neutral expression
6. Side profile face
7. 3/4 face angle`;

/** Appended to every panel: one subject, one angle, nothing that would survive into the montage. */
const PANEL_RULES =
  'One single subject alone in the frame, plain flat neutral gray background, no shadow on the background, even diffuse studio lighting, no text, no border, no other angle of the subject in frame.';

/**
 * The seven cells, in sheet order: four full-body angles, then three face close-ups.
 *
 * Each one states the rotation in degrees relative to the front view rather than a name like
 * "profile", because the angles are what collapsed into each other when a single render was asked
 * for all of them at once.
 */
const ANCHOR_PANELS: readonly AnchorPanel[] = [
  {
    id: 'body-front',
    label: 'Front, A-pose',
    kind: 'body',
    directive: `Full body from the front, standing straight in an A-pose with arms held slightly away from the body, feet shoulder width apart, facing camera, neutral expression, whole figure in frame from the top of the head to the feet with margin above and below. ${PANEL_RULES}`,
  },
  {
    id: 'body-side',
    label: 'Left side',
    kind: 'body',
    directive: `Full body strict left side view, the subject rotated exactly 90 degrees from the front view, same A-pose, nose and toes pointing to the left edge of the frame, whole figure in frame from head to feet. ${PANEL_RULES}`,
  },
  {
    id: 'body-back',
    label: 'Back',
    kind: 'body',
    directive: `Full body seen from directly behind, the subject rotated exactly 180 degrees from the front view, face not visible, same A-pose, back of the head, hair and the back of the outfit fully visible, whole figure in frame from head to feet. ${PANEL_RULES}`,
  },
  {
    id: 'body-three-quarter',
    label: 'Three-quarter',
    kind: 'body',
    directive: `Full body three-quarter view, the subject rotated exactly 45 degrees from the front view, head turned with the body, same A-pose, whole figure in frame from head to feet. ${PANEL_RULES}`,
  },
  {
    id: 'face-front',
    label: 'Face — front',
    kind: 'face',
    directive: `Head and shoulders close-up, face square to camera, neutral expression, eyes on the lens, sharp facial detail, the head filling most of the frame. ${PANEL_RULES}`,
  },
  {
    id: 'face-profile',
    label: 'Face — profile',
    kind: 'face',
    directive: `Head and shoulders close-up in strict side profile, the head rotated exactly 90 degrees so only one eye is visible, neutral expression, nose, lips and jaw silhouette clearly readable against the background. ${PANEL_RULES}`,
  },
  {
    id: 'face-three-quarter',
    label: 'Face — three-quarter',
    kind: 'face',
    directive: `Head and shoulders close-up with the head rotated exactly 45 degrees from the front, both eyes visible, neutral expression, cheekbone and jawline reading in depth. ${PANEL_RULES}`,
  },
];

const ANCHOR_SHEET_NEGATIVE =
  'inconsistent face between panels, inconsistent outfit between panels, mismatched hairstyle, different face identity, extra fingers, missing panels, collage borders, cropped figure';

const CHARACTER_VIEWS: readonly AssetView[] = [
  {
    id: 'portrait',
    label: 'Anchor character sheet',
    purpose: 'Seven panels in one image. The identity every other angle is generated against.',
    subject: 'Character reference sheet, multi-panel grid',
    directive: `${ANCHOR_SHEET_PANELS}

Plain flat gray background, no shadows, consistent lighting, same character identity (face/outfit/proportions/hair) across all 7 panels, orthographic view.`,
    negative: ANCHOR_SHEET_NEGATIVE,
    panels: ANCHOR_PANELS,
    aspect: '1:1',
    defaultOn: true,
    isAnchor: true,
  },
  {
    id: 'full-front',
    label: 'Full body — front',
    purpose: 'Proportions and the full signature outfit, head to feet.',
    directive: `Full body shot from the front, standing straight in a relaxed neutral pose, arms at sides, entire figure in frame including feet, flat frontal camera. ${SHEET_RULES}`,
    aspect: '9:16',
    defaultOn: true,
  },
  {
    id: 'three-quarter',
    label: 'Three-quarter',
    purpose: 'The angle most shots actually use — reads volume without losing the face.',
    directive: `Full body, rotated 45 degrees to camera left, weight on one leg, head turned slightly toward camera. ${SHEET_RULES}`,
    aspect: '9:16',
    defaultOn: true,
  },
  {
    id: 'profile',
    label: 'Side profile',
    purpose: 'Nose, jaw and hair silhouette — what breaks first when a model drifts.',
    directive: `Full body strict side profile, 90 degrees to camera, standing neutral, sharp silhouette. ${SHEET_RULES}`,
    aspect: '9:16',
  },
  {
    id: 'back',
    label: 'Back view',
    purpose: 'Hair, cape, backpack — everything a follow shot sees.',
    directive: `Full body seen from directly behind, standing neutral, back of head and outfit fully visible. ${SHEET_RULES}`,
    aspect: '9:16',
  },
  {
    id: 'expressions',
    label: 'Expression sheet',
    purpose: 'Gives the video model a range to interpolate instead of one frozen face.',
    directive: `Four head-and-shoulders portraits of the same character in a 2x2 grid, identical lighting and framing, expressions: neutral, joyful, angry, afraid. Consistent face across all four panels, plain background.`,
    aspect: '1:1',
  },
  {
    id: 'action',
    label: 'Signature action pose',
    purpose: 'How they move — the pose the character is remembered by.',
    directive: `Full body dynamic action pose that expresses this character's temperament, mid-motion, dramatic but readable silhouette, plain background, no motion blur on the face.`,
    aspect: '9:16',
  },
  {
    id: 'detail',
    label: 'Costume detail',
    purpose: 'Close on the props and marks that identify them at a glance.',
    directive: `Macro detail shot of this character's signature costume elements, accessories and distinguishing marks, shallow depth of field, no face in frame.`,
    aspect: '1:1',
  },
];

const PERSON_VIEWS: readonly AssetView[] = [
  {
    id: 'portrait',
    label: 'Anchor reference sheet',
    purpose: 'Seven panels in one image. The likeness every other framing is generated from.',
    subject: 'Photographic character reference sheet of a real person, multi-panel grid',
    directive: `${ANCHOR_SHEET_PANELS}

Plain flat gray background, no shadows, consistent lighting, same person identity (face/wardrobe/proportions/hair) across all 7 panels, orthographic view, photographic, true-to-life proportions.`,
    negative: ANCHOR_SHEET_NEGATIVE,
    panels: ANCHOR_PANELS,
    aspect: '1:1',
    defaultOn: true,
    isAnchor: true,
  },
  {
    id: 'presenter',
    label: 'Presenter framing',
    purpose: 'The talking-head setup this person actually appears in.',
    directive: `Medium shot from chest up, centred, presenting to camera, relaxed posture, shallow depth of field, soft three-point lighting.`,
    aspect: '16:9',
    defaultOn: true,
  },
  {
    id: 'three-quarter',
    label: 'Three-quarter',
    purpose: 'Off-axis coverage for cutaways and two-shots.',
    directive: `Medium shot rotated 45 degrees to camera, gaze slightly off lens, same lighting and wardrobe. ${SHEET_RULES}`,
    aspect: '16:9',
  },
  {
    id: 'full-body',
    label: 'Full body',
    purpose: 'Wardrobe and stance for wide shots.',
    directive: `Full body standing shot, front on, natural posture, complete wardrobe visible including shoes. ${SHEET_RULES}`,
    aspect: '9:16',
  },
  {
    id: 'gesture',
    label: 'Gesture / b-roll',
    purpose: 'Hands and energy — what cutaways are made of.',
    directive: `Medium shot mid-gesture while speaking, hands visible and expressive, candid documentary feel, natural environment light.`,
    aspect: '16:9',
  },
];

const STYLE_VIEWS: readonly AssetView[] = [
  {
    id: 'key-frame',
    label: 'Key frame',
    purpose: 'The single image that defines the look. Style transfer keys off this one.',
    directive: `A representative key frame in this visual style: one figure in an environment, composed as a finished shot. The subject is incidental — the medium, palette, lighting and finish are the point.`,
    aspect: '16:9',
    defaultOn: true,
    isAnchor: true,
  },
  {
    id: 'character-plate',
    label: 'Character plate',
    purpose: 'Proves the style holds on faces, which is where it usually breaks.',
    directive: `A close portrait of an anonymous figure rendered in this exact visual style, showing how skin, hair and eyes are drawn or lit in this medium.`,
    aspect: '1:1',
    defaultOn: true,
  },
  {
    id: 'environment-plate',
    label: 'Environment plate',
    purpose: 'How landscapes, architecture and depth are handled.',
    directive: `A wide establishing environment rendered in this exact visual style, no characters, showing how depth, atmosphere and background detail are treated.`,
    aspect: '16:9',
    defaultOn: true,
  },
  {
    id: 'palette',
    label: 'Colour script',
    purpose: 'A palette strip to grade every later shot against.',
    directive: `A horizontal colour-script strip of four abstract panels sampling this style's palette from its brightest to its darkest key, flat blocks of colour with soft gradients, no subject matter.`,
    aspect: '16:9',
  },
  {
    id: 'texture',
    label: 'Texture & finish',
    purpose: 'Grain, brushwork, halation — the finish that sells the medium.',
    directive: `Extreme close-up of the surface treatment of this style: brushwork, grain, line weight and edge quality, filling the frame, no recognizable subject.`,
    aspect: '1:1',
  },
];

const LOCATION_VIEWS: readonly AssetView[] = [
  {
    id: 'establishing',
    label: 'Establishing wide',
    purpose: 'The shot that tells the audience where they are.',
    directive: `Wide establishing shot of this location, camera at eye level or slightly raised, full context of the space visible, no people in frame.`,
    aspect: '16:9',
    defaultOn: true,
    isAnchor: true,
  },
  {
    id: 'entry',
    label: 'Entry / approach',
    purpose: 'What a character sees walking in — the default scene opener.',
    directive: `Eye-level shot looking into this location from its natural entrance or approach, leading lines toward the centre of the space, no people in frame.`,
    aspect: '16:9',
    defaultOn: true,
  },
  {
    id: 'reverse',
    label: 'Reverse angle',
    purpose: 'The other half of the geography — needed for any shot/reverse coverage.',
    directive: `Reverse angle of the same location, camera turned 180 degrees from the establishing shot, showing what is behind that viewpoint. Same time of day and weather.`,
    aspect: '16:9',
    defaultOn: true,
  },
  {
    id: 'aerial',
    label: 'High / aerial',
    purpose: 'Layout and scale — settles how the space fits together.',
    directive: `High angle looking down over this location, drone or rooftop height, showing the layout and how the space connects to its surroundings.`,
    aspect: '16:9',
  },
  {
    id: 'detail',
    label: 'Detail vignette',
    purpose: 'The textures and props that make the place specific.',
    directive: `Close-up vignette of a characteristic corner of this location: its materials, signage, props and wear, shallow depth of field.`,
    aspect: '1:1',
  },
  {
    id: 'alt-time',
    label: 'Alternate time of day',
    purpose: 'Same geography, different hour — so a night scene still matches.',
    directive: `The same location and camera position as the establishing wide, but at the opposite end of the day: if it was daylight, render it at night with practical lights; if it was night, render it in flat daylight. Geography and props identical.`,
    aspect: '16:9',
  },
];

const AMBIENCE_VIEWS: readonly AssetView[] = [
  {
    id: 'mood-plate',
    label: 'Mood plate',
    purpose: 'The light and weather in one frame, subject deliberately generic.',
    directive: `A wide atmospheric plate expressing this mood: sky, light quality, weather and colour cast are the subject. Generic unremarkable landscape or street, no identifiable landmark, no people.`,
    aspect: '16:9',
    defaultOn: true,
    isAnchor: true,
  },
  {
    id: 'sky',
    label: 'Sky & light study',
    purpose: 'What the key light is doing — the part a scene prompt inherits.',
    directive: `Upward-facing study of the sky and light source in this condition: cloud structure, sun or moon position, colour temperature. No ground detail.`,
    aspect: '16:9',
    defaultOn: true,
  },
  {
    id: 'ground',
    label: 'Ground-level detail',
    purpose: 'How the weather reads on surfaces — puddles, dust, frost.',
    directive: `Low ground-level close-up showing how this weather and light land on surfaces: wet asphalt, dust, snow, or dry heat shimmer. Shallow depth of field.`,
    aspect: '1:1',
  },
  {
    id: 'on-subject',
    label: 'Applied to a subject',
    purpose: 'Proof it works as a layer over a shot with someone in it.',
    directive: `A silhouetted anonymous figure standing in this atmosphere, backlit by its key light, showing how the condition wraps a subject. Figure unidentifiable.`,
    aspect: '9:16',
  },
];

const MAP_VIEWS: readonly AssetView[] = [
  {
    id: 'full',
    label: 'Full map',
    purpose: 'The canonical geography every later inset must agree with.',
    directive: `The complete map as a finished cartographic illustration, whole extent visible, legible labels, compass rose, clean margins. Flat graphic rendering, not a photograph.`,
    aspect: '16:9',
    defaultOn: true,
    isAnchor: true,
  },
  {
    id: 'region',
    label: 'Region inset',
    purpose: 'A zoom the story can actually point at.',
    directive: `A zoomed inset of the most story-relevant region of this map, same cartographic style and palette, more local detail and place names than the full map.`,
    aspect: '1:1',
    defaultOn: true,
  },
  {
    id: 'route',
    label: 'Route overlay',
    purpose: 'Movement across the world, drawn on top of the geography.',
    directive: `The same map with the principal routes, borders and journey lines drawn over it as a dashed overlay with waypoint markers, geography unchanged.`,
    aspect: '16:9',
  },
  {
    id: 'legend',
    label: 'Legend & cartouche',
    purpose: 'The decorative furniture that makes it read as one artifact.',
    directive: `A cartographic legend and title cartouche in this map's style: key symbols, scale bar, decorative border. No landmass, just the furniture.`,
    aspect: '1:1',
  },
];

const PROP_VIEWS: readonly AssetView[] = [
  {
    id: 'hero',
    label: 'Hero three-quarter',
    purpose: 'The object as the audience meets it. Everything else follows this one.',
    directive: `Three-quarter hero shot of this single object on a plain seamless background, product lighting, whole object in frame, sharp material detail. No hands, no environment.`,
    aspect: '1:1',
    defaultOn: true,
    isAnchor: true,
  },
  {
    id: 'front',
    label: 'Front orthographic',
    purpose: 'Flat elevation — the shape reference.',
    directive: `Strict front-on orthographic view of this object, no perspective distortion, centred, plain background, even lighting.`,
    aspect: '1:1',
    defaultOn: true,
  },
  {
    id: 'side',
    label: 'Side orthographic',
    purpose: 'Depth and thickness, which a front view hides.',
    directive: `Strict side-on orthographic view of the same object, 90 degrees from the front view, no perspective distortion, plain background.`,
    aspect: '1:1',
    defaultOn: true,
  },
  {
    id: 'back',
    label: 'Back',
    purpose: 'The face that shows when it is set down or carried.',
    directive: `Rear view of the same object, plain background, even lighting, showing fastenings and detail hidden from the front.`,
    aspect: '1:1',
  },
  {
    id: 'macro',
    label: 'Macro detail',
    purpose: 'Engravings, wear and material — the marks that make it this exact object.',
    directive: `Extreme macro close-up of this object's most distinctive markings, engraving or wear, filling the frame, shallow depth of field.`,
    aspect: '1:1',
  },
  {
    id: 'in-scale',
    label: 'In scale',
    purpose: 'How big it actually is — the thing text prompts never get right.',
    directive: `The object held in a human hand or set beside a common everyday item, neutral environment, making its real size unmistakable.`,
    aspect: '1:1',
  },
  {
    id: 'alt-state',
    label: 'Alternate state',
    purpose: 'Open, lit, broken — the second version scenes will ask for.',
    directive: `The same object in its alternate on-screen state — opened, activated, lit or damaged as appropriate — same angle and lighting as the hero shot.`,
    aspect: '1:1',
  },
];

export const ASSET_VIEW_PLANS: Record<AssetType, AssetViewPlan> = {
  CHARACTER: {
    type: 'CHARACTER',
    rationale:
      'A turnaround. The portrait locks the face, then every other angle is generated against it so the same person survives a cut.',
    views: CHARACTER_VIEWS,
  },
  PERSON: {
    type: 'PERSON',
    rationale:
      'Likeness first, then the framings a real presenter is actually shot in. Only render people who agreed to appear.',
    views: PERSON_VIEWS,
  },
  STYLE: {
    type: 'STYLE',
    rationale:
      'Style plates, not characters. Each one tests the look somewhere it usually breaks — faces, depth, palette, finish.',
    views: STYLE_VIEWS,
  },
  LOCATION: {
    type: 'LOCATION',
    rationale:
      'Coverage of a real space: establishing, approach and reverse give a scene somewhere to cut, and the geography stays consistent.',
    views: LOCATION_VIEWS,
  },
  AMBIENCE: {
    type: 'AMBIENCE',
    rationale:
      'A mood is light and weather, not a place. These plates keep the subject generic so the condition can be layered onto any location.',
    views: AMBIENCE_VIEWS,
  },
  MAP: {
    type: 'MAP',
    rationale: 'One canonical geography, then the zooms and overlays that reference it without contradicting it.',
    views: MAP_VIEWS,
  },
  PROP: {
    type: 'PROP',
    rationale: 'An orthographic set plus scale and state — what a modeller or a video model needs to keep one object one object.',
    views: PROP_VIEWS,
  },
  VOICE: {
    type: 'VOICE',
    rationale:
      'A voice has no viewpoints. Draft its direction here, then attach a reference sample — the render stages call TTS with it directly.',
    views: [],
  },
};

export function viewPlanOf(type: AssetType): AssetViewPlan {
  return ASSET_VIEW_PLANS[type];
}

export function viewOf(type: AssetType, viewId: string): AssetView | undefined {
  return ASSET_VIEW_PLANS[type].views.find((view) => view.id === viewId);
}

/** The identity view — generated first, then reused as the reference image for the rest. */
export function anchorViewOf(type: AssetType): AssetView | undefined {
  return ASSET_VIEW_PLANS[type].views.find((view) => view.isAnchor);
}

export function panelOf(view: AssetView, panelId: string): AnchorPanel | undefined {
  return view.panels?.find((panel) => panel.id === panelId);
}

/** How many images a view actually costs — a composed view is one render per panel. */
export function renderCountOf(view: AssetView): number {
  return view.panels?.length ?? 1;
}

export function defaultViewIdsOf(type: AssetType): string[] {
  return ASSET_VIEW_PLANS[type].views.filter((view) => view.defaultOn).map((view) => view.id);
}

/** `false` for VOICE — the lab has no image stage to offer. */
export function hasVisualViews(type: AssetType): boolean {
  return ASSET_VIEW_PLANS[type].views.length > 0;
}

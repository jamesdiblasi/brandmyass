/**
 * The inventory. Nine placements, laid out over a 600 × 740 SVG viewBox.
 *
 * The body is built from FIVE overlapping shapes rather than one outline: a
 * torso, two cheek ellipses, and two thighs. The first attempt used a single
 * hand-drawn silhouette and it read as a vase. Two ellipses whose edges cross
 * in the middle is what actually makes a backside legible — the overlap is the
 * cleft, and the eye resolves it instantly. The shapes are unioned by dropping
 * all five into one <clipPath>, and filled as one group so no internal seams
 * show.
 *
 * Every zone is an axis-aligned rounded rectangle clipped to that union. Two
 * reasons it is done that way rather than with organic blobs:
 *
 *   1. Rectangles tile without overlapping, so a click can only ever land in
 *      one zone and there is no z-order guesswork in the hit testing.
 *   2. A rigid media-buying grid stretched over a man's backside is funnier
 *      than an organic one, and the grid does the same job here that a
 *      placement map does on any out-of-home rate card.
 *
 * Columns: left 84–300 | right 300–516 — the two meet on the midline, so the
 * 6-unit gutter between them falls exactly on the cleft and reads as the
 * divider rather than as a gap.
 * Rows:    shelf 170–300 | flank 300–370 | prime 370–495 | sit 495–600 | thigh 600–720
 */

export type ZoneTier = 'prime' | 'standard' | 'bargain'

export interface Zone {
  /** Stable primary key. Never renumber these — bids reference them. */
  id: string
  name: string
  /** The one-line sales pitch shown on the zone card. */
  pitch: string
  /** Longer copy for the detail panel. */
  blurb: string
  tier: ZoneTier
  /** Physical tattoo size, printed on the rate card. */
  size: string
  /** Opening price in cents. Bids below this are refused. */
  reserveCents: number
  /** Rect in viewBox units. */
  rect: { x: number; y: number; w: number; h: number }
  /** Where the hotspot dot and label sit — hand-placed, because the geometric
   *  centre of a rect often lands outside the clipped body (the thighs). */
  anchor: { x: number; y: number }
}

/**
 * The five shapes that make up the body. Unioned in a clipPath, filled as one
 * group, so the joins are invisible.
 */
export const BODY = {
  /** Lower back flaring into the hips. Sits behind the cheeks. */
  torso:
    'M 205 130 C 245 118, 355 118, 395 130 C 400 174, 410 200, 422 226 C 452 282, 482 328, 488 392 L 112 392 C 118 328, 148 282, 178 226 C 190 200, 200 174, 205 130 Z',
  /** The cheeks. They overlap across x 265–335 — that overlap IS the cleft. */
  leftCheek: { cx: 200, cy: 445, rx: 135, ry: 155 },
  rightCheek: { cx: 400, cy: 445, rx: 135, ry: 155 },
  /** Thighs, running off the bottom edge with an inner gap. */
  leftThigh: 'M 118 540 C 112 610, 120 675, 126 730 L 288 730 C 292 670, 296 600, 294 540 Z',
  rightThigh: 'M 306 540 C 304 600, 308 670, 312 730 L 474 730 C 480 675, 488 610, 482 540 Z',
} as const

/** Drawn on top of the fills for depth. */
export const CLEFT_PATH = 'M 300 322 C 296 400, 296 480, 300 552'

/** The gluteal folds. Cheap to draw, and they do most of the anatomical work. */
export const FOLD_PATHS = [
  'M 122 545 C 160 600, 235 608, 292 572',
  'M 478 545 C 440 600, 365 608, 308 572',
] as const

export const ZONES: Zone[] = [
  {
    id: 'tramp-stamp',
    name: 'The Tramp Stamp',
    pitch: 'The most historically regrettable postcode on the human body.',
    blurb:
      'The widest single placement on the ass, and the only one that arrives with a cultural legacy attached. Sits exactly where a waistband gives up, which makes it the first thing visible every single time I bend over to plug in a monitor. Forty centimetres of uninterrupted lower back that has been sitting there since 2004 waiting for something to happen to it. Congratulations — you are what happens to it.',
    tier: 'prime',
    size: '40 × 14 cm',
    reserveCents: 50_000,
    rect: { x: 108, y: 165, w: 384, h: 135 },
    anchor: { x: 300, y: 236 },
  },
  {
    id: 'left-flank',
    name: 'Left Love Handle',
    pitch: 'Soft, generous, and completely yours.',
    blurb:
      'The gentle overhang where a belt digs in. Curved, forgiving, and honestly quite comfortable. Logos with rounded corners perform unreasonably well here. Logos belonging to gyms perform very badly here, for reasons I would rather not spell out.',
    tier: 'standard',
    size: '18 × 7 cm',
    reserveCents: 15_000,
    rect: { x: 84, y: 300, w: 216, h: 70 },
    anchor: { x: 190, y: 338 },
  },
  {
    id: 'right-flank',
    name: 'Right Love Handle',
    pitch: 'Identical to the left one. I am symmetrical, thank you.',
    blurb:
      'Everything the left love handle is, mirrored. Buy both and your logo wraps me like a poorly considered tattoo sleeve. Buy one and spend the rest of the campaign resenting whoever bought the other.',
    tier: 'standard',
    size: '18 × 7 cm',
    reserveCents: 15_000,
    rect: { x: 300, y: 300, w: 216, h: 70 },
    anchor: { x: 410, y: 338 },
  },
  {
    id: 'left-prime',
    name: 'Left Prime Cheek',
    pitch: 'The Times Square of my ass.',
    blurb:
      'The full sweep of the left cheek. Maximum surface, maximum curve, maximum shame. This is the placement people will photograph. It is also the placement my mother will see first, so please make it something I can explain at Christmas.',
    tier: 'prime',
    size: '18 × 14 cm',
    reserveCents: 40_000,
    rect: { x: 84, y: 370, w: 216, h: 125 },
    anchor: { x: 190, y: 448 },
  },
  {
    id: 'right-prime',
    name: 'Right Prime Cheek',
    pitch: 'The other Times Square. Same rent, better lighting.',
    blurb:
      'Structurally identical to the left cheek, but I favour this side when I sleep, so it is marginally rounder and I am marginally more attached to it. Sponsors of this zone are contractually entitled to describe themselves as "the good cheek" in all marketing materials.',
    tier: 'prime',
    size: '18 × 14 cm',
    reserveCents: 40_000,
    rect: { x: 300, y: 370, w: 216, h: 125 },
    anchor: { x: 410, y: 448 },
  },
  {
    id: 'left-sitbone',
    name: 'Left Sit Bone',
    pitch: 'Absorbs eight hours of office chair a day. Your logo will know suffering.',
    blurb:
      'The load-bearing underside of the left cheek. This placement will be sat on, compressed, and slowly ground into a Herman Miller for the entire length of the campaign. If your brand values are "resilience" and "endurance", I cannot offer you a more honest advertisement.',
    tier: 'standard',
    size: '18 × 10 cm',
    reserveCents: 20_000,
    rect: { x: 84, y: 495, w: 216, h: 105 },
    anchor: { x: 190, y: 548 },
  },
  {
    id: 'right-sitbone',
    name: 'Right Sit Bone',
    pitch: 'As above, but it takes slightly more of my weight. Sorry.',
    blurb:
      'I lean right. Twenty-eight years of leaning right. This zone therefore carries more punishment than any other placement on the body and is priced identically, which is either a bargain or a warning depending on how you feel about your logo being crushed daily.',
    tier: 'standard',
    size: '18 × 10 cm',
    reserveCents: 20_000,
    rect: { x: 300, y: 495, w: 216, h: 105 },
    anchor: { x: 410, y: 548 },
  },
  {
    id: 'left-under',
    name: 'Left Undercarriage',
    pitch: 'Cheap, and cheap for a very obvious reason.',
    blurb:
      'Below the curve, on the top of the thigh. Visibility is genuinely poor unless I am doing something undignified, which — statistically, even over a two-week campaign — I will be. Our most affordable inventory. Perfect for a startup with more nerve than budget.',
    tier: 'bargain',
    size: '20 × 11 cm',
    reserveCents: 12_500,
    rect: { x: 110, y: 600, w: 186, h: 120 },
    anchor: { x: 205, y: 658 },
  },
  {
    id: 'right-under',
    name: 'Right Undercarriage',
    pitch: 'The cheapest thing on this website, including my dignity.',
    blurb:
      'The last placement anybody bids on and the first one I forget I am wearing. Entry-level pricing for entry-level commitment. No judgement. Well — some judgement.',
    tier: 'bargain',
    size: '20 × 11 cm',
    reserveCents: 12_500,
    rect: { x: 304, y: 600, w: 186, h: 120 },
    anchor: { x: 395, y: 658 },
  },
]

export const ZONES_BY_ID: ReadonlyMap<string, Zone> = new Map(ZONES.map((z) => [z.id, z]))

export function getZone(id: string): Zone | undefined {
  return ZONES_BY_ID.get(id)
}

export const TIER_LABEL: Record<ZoneTier, string> = {
  prime: 'Prime',
  standard: 'Standard',
  bargain: 'Bargain',
}

/** Tier colours, used for the zone fills and the rate-card pills. */
export const TIER_COLOR: Record<ZoneTier, string> = {
  prime: '#ff0084',
  standard: '#ff5a00',
  bargain: '#99948f',
}

/**
 * Compact label for the SVG map, where "Left Undercarriage" will not fit.
 * Derived rather than stored so there is only one place a zone gets renamed.
 */
export function shortLabel(zone: Zone): string {
  return zone.name
    .replace(/^The /, '')
    .replace(/^Left /, 'L ')
    .replace(/^Right /, 'R ')
    .toUpperCase()
}

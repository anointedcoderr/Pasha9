// Built by Anointed Coder.
//
// Catalog of premium image asset slots for the Spin and Lotto pages.
// Mirrors the lib/sounds/slots.ts pattern: every slot is a
// SystemSetting key. The admin uploads a file via /admin/atelier,
// the public read endpoint serves the URL map, and the page
// components fall back to CSS-only renders when a slot is empty.

export interface AtelierSlot {
  /** SystemSetting key. */
  key: string;
  /** Identifier used by client components. */
  id: string;
  /** Admin-facing label. */
  label: string;
  /** Where the asset shows up on the public site. */
  description: string;
  /** Recommended ratio / dimensions hint. */
  ratioHint: string;
  /** Tier of importance for grouping in the admin page. */
  tier: 1 | 2 | 3;
  /** Display group. */
  group: 'hero' | 'crest' | 'ball' | 'texture';
}

export const ATELIER_SLOTS: AtelierSlot[] = [
  // Tier 1: hero backdrops + tier crests
  {
    key: 'atelier_spin_hero_backdrop', id: 'spin_hero_backdrop',
    label: 'Spin: hero backdrop',
    description: 'Cinematic photo behind the Spin tab. Dimmed to ~40% with UI overlay.',
    ratioHint: '21:9, 2560x1080, JPG, < 400KB',
    tier: 1, group: 'hero',
  },
  {
    key: 'atelier_lotto_hero_backdrop', id: 'lotto_hero_backdrop',
    label: 'Lotto: hero backdrop',
    description: 'Cinematic photo behind the Lotto hero strip.',
    ratioHint: '21:9, 2560x1080, JPG, < 400KB',
    tier: 1, group: 'hero',
  },
  {
    key: 'atelier_spin_tier_crest_lucky', id: 'spin_tier_crest_lucky',
    label: 'Spin tier crest: Lucky (jade)',
    description: 'Floating jade-and-gold medallion shown on the Lucky tier card and wheel header.',
    ratioHint: '1:1, 1024x1024, PNG transparent, < 200KB',
    tier: 1, group: 'crest',
  },
  {
    key: 'atelier_spin_tier_crest_royal', id: 'spin_tier_crest_royal',
    label: 'Spin tier crest: Royal (ruby)',
    description: 'Floating ruby-and-gold medallion shown on the Royal tier card.',
    ratioHint: '1:1, 1024x1024, PNG transparent, < 200KB',
    tier: 1, group: 'crest',
  },
  {
    key: 'atelier_spin_tier_crest_supreme', id: 'spin_tier_crest_supreme',
    label: 'Spin tier crest: Supreme (onyx + topaz)',
    description: 'Floating onyx-and-gold medallion shown on the Supreme tier card.',
    ratioHint: '1:1, 1024x1024, PNG transparent, < 200KB',
    tier: 1, group: 'crest',
  },
  // Tier 2: lottery balls
  {
    key: 'atelier_lotto_ball_gold', id: 'lotto_ball_gold',
    label: 'Lotto ball: gold (1st prize)',
    description: 'Polished gold sphere with a blank face for digit overlay.',
    ratioHint: '1:1, 512x512, PNG transparent, < 80KB',
    tier: 2, group: 'ball',
  },
  {
    key: 'atelier_lotto_ball_silver', id: 'lotto_ball_silver',
    label: 'Lotto ball: silver (2nd prize)',
    description: 'Polished silver sphere.',
    ratioHint: '1:1, 512x512, PNG transparent, < 80KB',
    tier: 2, group: 'ball',
  },
  {
    key: 'atelier_lotto_ball_bronze', id: 'lotto_ball_bronze',
    label: 'Lotto ball: bronze (3rd prize)',
    description: 'Polished bronze sphere.',
    ratioHint: '1:1, 512x512, PNG transparent, < 80KB',
    tier: 2, group: 'ball',
  },
  {
    key: 'atelier_lotto_ball_emerald', id: 'lotto_ball_emerald',
    label: 'Lotto ball: emerald (special / consolation)',
    description: 'Glossy emerald sphere.',
    ratioHint: '1:1, 512x512, PNG transparent, < 80KB',
    tier: 2, group: 'ball',
  },
  // Tier 3: textures + accent overlays
  {
    key: 'atelier_spin_hub_gem', id: 'spin_hub_gem',
    label: 'Spin: wheel hub gem',
    description: 'Faceted topaz gem rendered in gold prongs. Sits in the wheel center button.',
    ratioHint: '1:1, 512x512, PNG transparent, < 80KB',
    tier: 3, group: 'crest',
  },
  {
    key: 'atelier_texture_brass_tile', id: 'texture_brass_tile',
    label: 'Texture: brass plate (tileable)',
    description: 'Seamless tile used behind engraved labels.',
    ratioHint: '1:1, 1024x1024, JPG seamless',
    tier: 3, group: 'texture',
  },
  {
    key: 'atelier_texture_mahogany_tile', id: 'texture_mahogany_tile',
    label: 'Texture: mahogany velvet (tileable)',
    description: 'Seamless tile used as deep backdrop on tier cards.',
    ratioHint: '1:1, 1024x1024, JPG seamless',
    tier: 3, group: 'texture',
  },
  {
    key: 'atelier_texture_holo_foil', id: 'texture_holo_foil',
    label: 'Texture: holographic foil',
    description: 'Translucent shimmer overlay on the ticket card.',
    ratioHint: '1:1, 1024x1024, PNG transparent',
    tier: 3, group: 'texture',
  },
  {
    key: 'atelier_texture_paper_grain', id: 'texture_paper_grain',
    label: 'Texture: paper grain',
    description: 'Subtle aged-paper overlay on certificates.',
    ratioHint: '1:1, 1024x1024, PNG transparent',
    tier: 3, group: 'texture',
  },
  {
    key: 'atelier_texture_stamp_ink', id: 'texture_stamp_ink',
    label: 'Texture: stamp ink',
    description: 'Red ink texture used for the WINNER stamp.',
    ratioHint: '1:1, 1024x1024, PNG transparent',
    tier: 3, group: 'texture',
  },
  {
    key: 'atelier_texture_gold_sweep', id: 'texture_gold_sweep',
    label: 'Texture: gold leaf sweep',
    description: 'Diagonal gold shine sweep across headlines.',
    ratioHint: '21:9, 1920x820, PNG transparent',
    tier: 3, group: 'texture',
  },
];

// The 12 seasonal palettes. Research-backed, wearable hues. Each palette powers the
// swatch reveal, the "why these colors" copy, and the garment recolor + try-on.

import type { Season, ParentSeason } from './season'

export interface Swatch { name: string; hex: string }
export interface Palette {
  season: Season
  parent: ParentSeason
  tagline: string
  why: string
  /** flattering palette (wearable colors) */
  colors: Swatch[]
  /** soft neutrals that suit the season */
  neutrals: Swatch[]
  /** the single most flattering hero color (used for the hero try-on) */
  hero: Swatch
  /** a deliberately clashing color from the opposite temperature (for the compare) */
  clash: Swatch
  /**
   * Hair shades that sit in this season's range. Standard seasonal analysis treats hair as
   * an axis of the read, and YouCam already returns the wearer's measured hair color, so
   * these are what that measurement gets compared against.
   */
  hair: Swatch[]
}

const P: Record<Season, Palette> = {
  'Light Spring': {
    season: 'Light Spring', parent: 'Spring',
    tagline: 'Warm, delicate and fresh',
    why: 'Your warm undertone and light coloring glow in soft, sun-warmed pastels, clear but never heavy. Save the dark, icy shades for someone cooler.',
    colors: [
      { name: 'Peach', hex: '#ffc9a8' }, { name: 'Coral', hex: '#ff8f79' },
      { name: 'Warm Mint', hex: '#a8e6c1' }, { name: 'Butter', hex: '#ffe08a' },
      { name: 'Aqua', hex: '#7fd6d0' }, { name: 'Warm Pink', hex: '#ffb3a8' },
      { name: 'Periwinkle', hex: '#9db4f0' }, { name: 'Light Warm Green', hex: '#bcd97a' },
      { name: 'Apricot', hex: '#ffbf7a' }, { name: 'Warm Lilac', hex: '#c4a2e0' },
    ],
    neutrals: [{ name: 'Ivory', hex: '#f6efe0' }, { name: 'Camel', hex: '#c8a06a' }, { name: 'Warm Grey', hex: '#c7bcae' }],
    hero: { name: 'Coral', hex: '#ff8f79' },
    clash: { name: 'Icy Charcoal', hex: '#3a3f4a' },
    hair: [{ name: 'Light Golden Blonde', hex: '#d9b371' }, { name: 'Honey', hex: '#c08f4a' }, { name: 'Light Warm Brown', hex: '#ab7c4e' }],
  },
  'True Spring': {
    season: 'True Spring', parent: 'Spring',
    tagline: 'Warm, clear and golden',
    why: 'Warm and bright is your sweet spot: think coral, golden yellow and warm turquoise. Muted or dusty shades dull your natural warmth.',
    colors: [
      { name: 'Coral', hex: '#ff7a5c' }, { name: 'Golden Yellow', hex: '#ffca3a' },
      { name: 'Warm Turquoise', hex: '#2ec4b6' }, { name: 'Apple Green', hex: '#8fd14f' },
      { name: 'Warm Pink', hex: '#ff8fa3' }, { name: 'Peach', hex: '#ffab73' },
      { name: 'Bright Warm Red', hex: '#f4442e' }, { name: 'Clear Blue', hex: '#2f9fd6' },
      { name: 'Marigold', hex: '#ffa62b' }, { name: 'Fern', hex: '#3f8f3a' },
    ],
    neutrals: [{ name: 'Ivory', hex: '#f4ead2' }, { name: 'Camel', hex: '#c69551' }, { name: 'Warm Navy', hex: '#2b3a67' }],
    hero: { name: 'Coral', hex: '#ff7a5c' },
    clash: { name: 'Dusty Mauve', hex: '#9a7f89' },
    hair: [{ name: 'Golden Blonde', hex: '#cba055' }, { name: 'Copper', hex: '#a85a2b' }, { name: 'Warm Brown', hex: '#7d5230' }],
  },
  'Bright Spring': {
    season: 'Bright Spring', parent: 'Spring',
    tagline: 'Warm and vivid',
    why: 'High contrast and warmth let you carry saturated, clear color. Vivid coral, turquoise and warm bright pink energize you; muddy tones flatten you.',
    colors: [
      { name: 'Bright Coral', hex: '#ff5a4d' }, { name: 'Turquoise', hex: '#00d4d4' },
      { name: 'Warm Bright Pink', hex: '#ff5d8f' }, { name: 'Golden Yellow', hex: '#ffd60a' },
      { name: 'Warm Emerald', hex: '#12b886' }, { name: 'Bright Red', hex: '#f62c41' },
      { name: 'Aqua', hex: '#22d3ee' }, { name: 'Warm Violet', hex: '#8b5cf6' },
      { name: 'Tangerine', hex: '#ff8c1a' }, { name: 'Lime', hex: '#a3e635' },
    ],
    neutrals: [{ name: 'Bright Ivory', hex: '#f7f0dd' }, { name: 'Warm Taupe', hex: '#b89b7a' }, { name: 'True Navy', hex: '#1e2a5a' }],
    hero: { name: 'Turquoise', hex: '#00d4d4' },
    clash: { name: 'Dusty Sage', hex: '#9aa789' },
    hair: [{ name: 'Bright Copper', hex: '#b4551f' }, { name: 'Golden Brown', hex: '#8a5a2a' }, { name: 'Rich Warm Brown', hex: '#5f3c1e' }],
  },
  'Light Summer': {
    season: 'Light Summer', parent: 'Summer',
    tagline: 'Cool, soft and airy',
    why: 'Your cool, light coloring loves soft, powdery pastels. Gentle rose, powder blue and lavender flatter you; warm earthy tones overwhelm.',
    colors: [
      { name: 'Powder Blue', hex: '#a9cce3' }, { name: 'Soft Rose', hex: '#f2b9c4' },
      { name: 'Lavender', hex: '#c3b1e1' }, { name: 'Mint', hex: '#b8e0d2' },
      { name: 'Cool Rose', hex: '#e2a0b8' }, { name: 'Periwinkle', hex: '#9fa8da' },
      { name: 'Soft Teal', hex: '#7fb7be' }, { name: 'Light Plum', hex: '#b491b0' },
      { name: 'Cool Lemon', hex: '#eae7a8' }, { name: 'Cool Blue', hex: '#8bb8e8' },
    ],
    neutrals: [{ name: 'Soft White', hex: '#eef1f4' }, { name: 'Cool Grey', hex: '#b7bfc7' }, { name: 'Slate', hex: '#6d7f92' }],
    hero: { name: 'Soft Rose', hex: '#f2b9c4' },
    clash: { name: 'Pumpkin', hex: '#d9662b' },
    hair: [{ name: 'Ash Blonde', hex: '#c7b49a' }, { name: 'Cool Light Brown', hex: '#8f7d6c' }, { name: 'Soft Taupe', hex: '#a89684' }],
  },
  'True Summer': {
    season: 'True Summer', parent: 'Summer',
    tagline: 'Cool, soft and elegant',
    why: 'Cool and muted is your signature: dusty rose, slate blue and soft raspberry. Bright warm colors fight your gentle contrast.',
    colors: [
      { name: 'Soft Fuchsia', hex: '#c65b93' }, { name: 'Slate Blue', hex: '#5c7fb3' },
      { name: 'Dusty Rose', hex: '#c98aa0' }, { name: 'Cool Teal', hex: '#3f8f9d' },
      { name: 'Lavender', hex: '#a78bc0' }, { name: 'Raspberry', hex: '#b03a6e' },
      { name: 'Grey Blue', hex: '#7a93b3' }, { name: 'Mauve', hex: '#a06f92' },
      { name: 'Denim', hex: '#4f6d9c' }, { name: 'Soft Burgundy', hex: '#8a3b52' },
    ],
    neutrals: [{ name: 'Soft White', hex: '#eceff2' }, { name: 'Cool Taupe', hex: '#a99fa0' }, { name: 'Navy', hex: '#2f3d63' }],
    hero: { name: 'Soft Fuchsia', hex: '#c65b93' },
    clash: { name: 'Mustard', hex: '#caa02c' },
    hair: [{ name: 'Cool Brown', hex: '#6f5b4e' }, { name: 'Ash Brown', hex: '#7d6d61' }, { name: 'Soft Cool Blonde', hex: '#b3a189' }],
  },
  'Soft Summer': {
    season: 'Soft Summer', parent: 'Summer',
    tagline: 'Cool, muted and understated',
    why: 'Low contrast and cool warmth suit gentle, greyed-down color. Mauve, dusty teal and soft plum harmonize; anything vivid overpowers you.',
    colors: [
      { name: 'Mauve', hex: '#a37e93' }, { name: 'Dusty Teal', hex: '#5f8c8a' },
      { name: 'Soft Plum', hex: '#8a6a86' }, { name: 'Rose Brown', hex: '#b08a8a' },
      { name: 'Sage', hex: '#9caf88' }, { name: 'Slate', hex: '#727f8c' },
      { name: 'Dusty Rose', hex: '#c39aa4' }, { name: 'Cocoa', hex: '#7d6a63' },
      { name: 'Muted Denim', hex: '#697f9c' }, { name: 'Soft Burgundy', hex: '#7e4a55' },
    ],
    neutrals: [{ name: 'Pearl', hex: '#e8e6e3' }, { name: 'Taupe', hex: '#9c9187' }, { name: 'Charcoal', hex: '#4a4e57' }],
    hero: { name: 'Mauve', hex: '#a37e93' },
    clash: { name: 'Bright Orange', hex: '#ff7518' },
    hair: [{ name: 'Mushroom Brown', hex: '#7a6a60' }, { name: 'Soft Ash Brown', hex: '#6b5c53' }, { name: 'Cool Taupe', hex: '#94867c' }],
  },
  'Soft Autumn': {
    season: 'Soft Autumn', parent: 'Autumn',
    tagline: 'Warm, muted and earthy',
    why: 'Warm but gently muted: think salmon, sage and camel. Soft earthy tones flatter your low contrast; icy brights look harsh.',
    colors: [
      { name: 'Salmon', hex: '#e08a6f' }, { name: 'Sage', hex: '#a8ac66' },
      { name: 'Camel', hex: '#c69a63' }, { name: 'Soft Teal', hex: '#5f9a92' },
      { name: 'Warm Taupe', hex: '#b39374' }, { name: 'Dusty Blue', hex: '#7d95a3' },
      { name: 'Olive', hex: '#8a8a4a' }, { name: 'Muted Gold', hex: '#c9a44c' },
      { name: 'Terracotta', hex: '#c56a4e' }, { name: 'Muted Plum', hex: '#8a6070' },
    ],
    neutrals: [{ name: 'Cream', hex: '#efe6d2' }, { name: 'Stone', hex: '#b3a793' }, { name: 'Coffee', hex: '#6b5545' }],
    hero: { name: 'Terracotta', hex: '#c56a4e' },
    clash: { name: 'Icy Blue', hex: '#a9d6e5' },
    hair: [{ name: 'Warm Mushroom', hex: '#8a6f56' }, { name: 'Soft Caramel', hex: '#a87c4c' }, { name: 'Muted Auburn', hex: '#8f5738' }],
  },
  'True Autumn': {
    season: 'True Autumn', parent: 'Autumn',
    tagline: 'Warm, rich and golden',
    why: 'Warm and earthy is home: rust, olive, mustard and terracotta. Rich, spicy color brings out your golden warmth; cool pastels wash you out.',
    colors: [
      { name: 'Rust', hex: '#b5461f' }, { name: 'Olive', hex: '#78802f' },
      { name: 'Mustard', hex: '#d1a017' }, { name: 'Aubergine', hex: '#6b3550' },
      { name: 'Forest Green', hex: '#3f6b3a' }, { name: 'Warm Brown', hex: '#8a5a34' },
      { name: 'Teal', hex: '#2f7d78' }, { name: 'Tomato', hex: '#d94b2b' },
      { name: 'Pumpkin', hex: '#df7527' }, { name: 'Bronze', hex: '#a67c2e' },
    ],
    neutrals: [{ name: 'Cream', hex: '#efe2c6' }, { name: 'Khaki', hex: '#b09a6b' }, { name: 'Espresso', hex: '#4a3527' }],
    hero: { name: 'Rust', hex: '#b5461f' },
    clash: { name: 'Icy Pink', hex: '#f4c7de' },
    hair: [{ name: 'Rich Auburn', hex: '#8f4a24' }, { name: 'Copper', hex: '#a75f2c' }, { name: 'Golden Brown', hex: '#7a5228' }],
  },
  'Deep Autumn': {
    season: 'Deep Autumn', parent: 'Autumn',
    tagline: 'Warm, deep and spicy',
    why: 'Your depth carries rich, warm darks: chocolate, deep teal, brick and bronze. Dark, spicy color grounds you; pale washed shades disappear on you.',
    colors: [
      { name: 'Chocolate', hex: '#5a3720' }, { name: 'Deep Teal', hex: '#1f5f5b' },
      { name: 'Brick Red', hex: '#9e3b2e' }, { name: 'Deep Olive', hex: '#5b5f22' },
      { name: 'Mustard', hex: '#9d6e0c' }, { name: 'Warm Aubergine', hex: '#5a2a3a' },
      { name: 'Forest Green', hex: '#2f5233' }, { name: 'Bronze', hex: '#8a6321' },
      { name: 'Deep Marine', hex: '#23485f' }, { name: 'Pumpkin', hex: '#c56b1e' },
    ],
    neutrals: [{ name: 'Warm Cream', hex: '#e8d8b8' }, { name: 'Bronze Brown', hex: '#6e4a2c' }, { name: 'Near Black', hex: '#2b241d' }],
    hero: { name: 'Deep Teal', hex: '#1f5f5b' },
    clash: { name: 'Baby Blue', hex: '#bfe0f0' },
    hair: [{ name: 'Dark Chocolate', hex: '#4a3221' }, { name: 'Deep Auburn', hex: '#5e2f1c' }, { name: 'Espresso', hex: '#3a2618' }],
  },
  'Deep Winter': {
    season: 'Deep Winter', parent: 'Winter',
    tagline: 'Cool, deep and dramatic',
    why: 'High contrast and cool depth let you wear intense, dramatic color: burgundy, pine, royal blue against true black and white. Muted earth tones dull you.',
    colors: [
      { name: 'Burgundy', hex: '#6e1f2e' }, { name: 'Pine Green', hex: '#14503c' },
      { name: 'Royal Blue', hex: '#1f3fa8' }, { name: 'Magenta', hex: '#b5187f' },
      { name: 'Icy Blue', hex: '#cfe6f5' }, { name: 'Deep Plum', hex: '#4a1f52' },
      { name: 'Emerald', hex: '#0f7a4a' }, { name: 'True Red', hex: '#c31230' },
      { name: 'Sapphire Teal', hex: '#0e5a6e' }, { name: 'Charcoal', hex: '#2b2f36' },
    ],
    neutrals: [{ name: 'True White', hex: '#fbfcfe' }, { name: 'Charcoal', hex: '#2b2f36' }, { name: 'Black', hex: '#111318' }],
    hero: { name: 'Royal Blue', hex: '#1f3fa8' },
    clash: { name: 'Muted Camel', hex: '#c2a06a' },
    hair: [{ name: 'Near Black', hex: '#221c1c' }, { name: 'Dark Cool Brown', hex: '#3b2f2c' }, { name: 'Cool Espresso', hex: '#2e2523' }],
  },
  'True Winter': {
    season: 'True Winter', parent: 'Winter',
    tagline: 'Cool, clear and striking',
    why: 'Cool and crisp is your power: true red, royal blue and emerald against black and icy white. Warm, muted tones fight your clarity.',
    colors: [
      { name: 'True Red', hex: '#d0021b' }, { name: 'Royal Blue', hex: '#1e50c8' },
      { name: 'Emerald', hex: '#0a8f5b' }, { name: 'Fuchsia', hex: '#d61c8c' },
      { name: 'Icy Pink', hex: '#f3c6dd' }, { name: 'Turquoise', hex: '#00a8cc' },
      { name: 'Deep Purple', hex: '#4b1e8c' }, { name: 'Pine', hex: '#067054' },
      { name: 'Lemon Ice', hex: '#f4f6c8' }, { name: 'Hot Pink', hex: '#e83e8c' },
    ],
    neutrals: [{ name: 'Pure White', hex: '#ffffff' }, { name: 'Cool Grey', hex: '#8a919b' }, { name: 'Black', hex: '#0e1013' }],
    hero: { name: 'True Red', hex: '#d0021b' },
    clash: { name: 'Warm Olive', hex: '#8a8a4a' },
    hair: [{ name: 'True Black', hex: '#1a1718' }, { name: 'Dark Ash Brown', hex: '#3a3230' }, { name: 'Cool Dark Brown', hex: '#2b2422' }],
  },
  'Bright Winter': {
    season: 'Bright Winter', parent: 'Winter',
    tagline: 'Cool and electric',
    why: 'Maximum contrast and clarity. You own electric, saturated color. Hot pink, electric blue and emerald pop against black and white; anything dusty falls flat.',
    colors: [
      { name: 'Hot Pink', hex: '#ff5fb0' }, { name: 'Electric Blue', hex: '#1f6bff' },
      { name: 'True Red', hex: '#e8003f' }, { name: 'Emerald', hex: '#00a86b' },
      { name: 'Cobalt', hex: '#0047ff' }, { name: 'Bright Fuchsia', hex: '#f200b0' },
      { name: 'Violet', hex: '#7b2ff7' }, { name: 'Cool Lemon', hex: '#eaff3a' },
      { name: 'Turquoise', hex: '#00c2d1' }, { name: 'Icy White', hex: '#f4fbff' },
    ],
    neutrals: [{ name: 'Pure White', hex: '#ffffff' }, { name: 'Silver Grey', hex: '#9aa3ae' }, { name: 'Black', hex: '#0c0e12' }],
    hero: { name: 'Electric Blue', hex: '#1f6bff' },
    clash: { name: 'Dusty Camel', hex: '#c3a878' },
    hair: [{ name: 'Jet Black', hex: '#141213' }, { name: 'Dark Cool Brown', hex: '#352c2b' }, { name: 'Icy Platinum', hex: '#ddd6cf' }],
  },
}

export function getPalette(season: Season): Palette {
  return P[season]
}

export const ALL_SEASONS = Object.keys(P) as Season[]

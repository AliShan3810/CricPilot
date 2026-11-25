import type { TextStyle } from 'react-native';

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Softer, larger radii for a modern sports look; scoring keys use `key`. */
export const radius = {
  sm: 10,
  md: 16,
  key: 20,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

/**
 * Three type families, each with one job:
 * - Outfit: headings, navigation, titles
 * - Barlow Condensed: scores, overs, statistics, results
 * - Manrope: body text, fields, buttons
 */
export const fonts = {
  regular: 'Manrope-Regular',
  medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
  extrabold: 'Manrope-ExtraBold',
  heading: 'Outfit-Bold',
  headingSemi: 'Outfit-SemiBold',
  headingHeavy: 'Outfit-ExtraBold',
  headingBlack: 'Outfit-Black',
  scoreSemibold: 'BarlowCondensed-SemiBold',
  score: 'BarlowCondensed-Bold',
  scoreHeavy: 'BarlowCondensed-ExtraBold',
} as const;

export type TypeVariant =
  | 'hero'
  | 'display'
  | 'score'
  | 'stat'
  | 'statSmall'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'overline'
  | 'nav';

export const typography: Record<TypeVariant, TextStyle> = {
  hero: { fontFamily: fonts.scoreHeavy, fontSize: 84, lineHeight: 86, letterSpacing: -1 },
  display: { fontFamily: fonts.scoreHeavy, fontSize: 60, lineHeight: 64, letterSpacing: -0.5 },
  score: { fontFamily: fonts.scoreHeavy, fontSize: 44, lineHeight: 48 },
  stat: { fontFamily: fonts.score, fontSize: 30, lineHeight: 34 },
  statSmall: { fontFamily: fonts.score, fontSize: 21, lineHeight: 25 },
  h1: { fontFamily: fonts.headingHeavy, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.headingSemi, fontSize: 17, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.headingSemi, fontSize: 11, lineHeight: 14, letterSpacing: 1.8, textTransform: 'uppercase' },
  nav: { fontFamily: fonts.headingSemi, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
};

export const MAX_FONT_SCALE = 1.4;

export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  celebration: 1400,
  spring: { damping: 16, stiffness: 180, mass: 1 },
  softSpring: { damping: 20, stiffness: 120, mass: 1 },
  bouncy: { damping: 11, stiffness: 160, mass: 1 },
} as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const HIT = 48;

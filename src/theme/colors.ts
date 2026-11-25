/**
 * CricPilot colour system: orange energy on midnight navy and charcoal, with warm white.
 * Orange is used selectively (primary actions, active states, featured info), never everywhere.
 */
export interface Palette {
  mode: 'dark' | 'light';
  /** brand orange */
  primary: string;
  /** brighter orange for gradients and highlights */
  primaryBright: string;
  /** deeper orange for pressed states and gradient ends */
  primaryStrong: string;
  /** text/icon colour on orange */
  onPrimary: string;
  navy: string;
  background: string;
  card: string;
  surface: string;
  surfaceHigh: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  gold: string;
  onGold: string;
  success: string;
  danger: string;
  onDanger: string;
  extra: string;
  onExtra: string;
  info: string;
  border: string;
  borderStrong: string;
  overlay: string;
  scrim: string;
  /** gradient used over background photos: [top, middle, bottom] */
  imageOverlay: [string, string, string];
  glass: string;
  shadow: string;
  /** orange gradient stops for primary buttons and featured surfaces */
  heat: [string, string];
  ball: {
    dot: string;
    run: string;
    four: string;
    six: string;
    wicket: string;
    extra: string;
  };
}

export const dark: Palette = {
  mode: 'dark',
  primary: '#FF6B00',
  primaryBright: '#FF8C42',
  primaryStrong: '#E85D00',
  onPrimary: '#0B1120',
  navy: '#0B1120',
  background: '#0D1117',
  card: '#171E2B',
  surface: '#222B3A',
  surfaceHigh: '#2C3747',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  gold: '#FBBF24',
  onGold: '#1F1300',
  success: '#22C55E',
  danger: '#F43F5E',
  onDanger: '#FFFFFF',
  extra: '#A78BFA',
  onExtra: '#140A2E',
  info: '#38BDF8',
  border: '#263041',
  borderStrong: '#3A4659',
  overlay: 'rgba(13,17,23,0.82)',
  scrim: 'rgba(5,8,14,0.66)',
  imageOverlay: ['rgba(11,17,32,0.45)', 'rgba(13,17,23,0.72)', 'rgba(13,17,23,0.98)'],
  glass: 'rgba(23,30,43,0.80)',
  shadow: '#000000',
  heat: ['#FF8C42', '#FF6B00'],
  ball: {
    dot: '#2C3747',
    run: '#3A4659',
    four: '#FF8C42',
    six: '#FBBF24',
    wicket: '#F43F5E',
    extra: '#A78BFA',
  },
};

export const light: Palette = {
  mode: 'light',
  primary: '#F97316',
  primaryBright: '#FB923C',
  primaryStrong: '#EA580C',
  onPrimary: '#111827',
  navy: '#0B1120',
  background: '#F8F9FC',
  card: '#FFFFFF',
  surface: '#F1F3F8',
  surfaceHigh: '#E7EAF1',
  text: '#111827',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  gold: '#B45309',
  onGold: '#FFFFFF',
  success: '#15803D',
  danger: '#E11D48',
  onDanger: '#FFFFFF',
  extra: '#6D28D9',
  onExtra: '#FFFFFF',
  info: '#0369A1',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  overlay: 'rgba(248,249,252,0.86)',
  scrim: 'rgba(17,24,39,0.45)',
  imageOverlay: ['rgba(248,249,252,0.40)', 'rgba(248,249,252,0.82)', 'rgba(248,249,252,0.98)'],
  glass: 'rgba(255,255,255,0.88)',
  shadow: '#0F172A',
  heat: ['#FB923C', '#F97316'],
  ball: {
    dot: '#E7EAF1',
    run: '#D1D5DB',
    four: '#F97316',
    six: '#B45309',
    wicket: '#E11D48',
    extra: '#6D28D9',
  },
};

/** Team colours offered when creating a team. */
export const TEAM_COLORS = [
  '#FF6B00',
  '#38BDF8',
  '#22C55E',
  '#FBBF24',
  '#F43F5E',
  '#A78BFA',
  '#14B8A6',
  '#6366F1',
  '#EC4899',
  '#84CC16',
  '#0EA5E9',
  '#F8FAFC',
];

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Picks dark or light text for a given background colour. */
export function readableOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.5 ? '#0B1120' : '#FFFFFF';
}

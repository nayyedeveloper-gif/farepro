/** TeamLink mobile design tokens — aligned with web Zello/TeamLink brand */
export const T = {
  // Brand
  brand: '#F26522',
  brandDim: 'rgba(242,101,34,0.12)',
  brandGlow: 'rgba(242,101,34,0.25)',

  // PTT / operational green
  ptt: '#2d9c78',
  pttBright: '#34b88a',
  pttDim: 'rgba(45,156,120,0.12)',

  // Backgrounds
  bg: '#080c10',
  bgElevated: '#0e1419',
  surface: '#141c24',
  surfaceRaised: '#1a2430',
  surfaceGlass: 'rgba(255,255,255,0.04)',

  // Borders
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',

  // Text
  text: '#eef2f6',
  textSecondary: 'rgba(238,242,246,0.65)',
  textMuted: 'rgba(238,242,246,0.4)',
  textFaint: 'rgba(238,242,246,0.25)',

  // Status
  online: '#34b88a',
  busy: '#f39c12',
  offline: '#5c6b7a',
  danger: '#e74c3c',
  dangerDim: 'rgba(231,76,60,0.12)',

  // Radii
  rSm: 8,
  rMd: 12,
  rLg: 16,
  rXl: 20,
  rFull: 999,

  // Type scale
  fsXs: 11,
  fsSm: 13,
  fsMd: 15,
  fsLg: 17,
  fsXl: 22,
  fsXxl: 28,
  fsHero: 34,

  // Tab bar
  tabHeight: 64,
  tabBg: '#0a1016',
} as const;

export const AVATAR_COLORS = [
  '#F26522', '#2d9c78', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

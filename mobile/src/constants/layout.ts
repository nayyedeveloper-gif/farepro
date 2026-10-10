import { T } from './design';

/** 4pt grid spacing scale */
export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const L = {
  screenPadding: S.lg,
  appBarHeight: 56,
  iconButtonSize: 44,
  tabBarHeight: T.tabHeight,
  listItemMinHeight: 64,
  searchHeight: 44,
  cardRadius: T.rLg,
  sectionGap: S.sm,
} as const;

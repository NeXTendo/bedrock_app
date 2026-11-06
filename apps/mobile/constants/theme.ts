/**
 * Warm Amber Theme — earthy, civic, readable.
 * Zinc base with amber accent pops for a grounded premium feel.
 */

import { Platform } from 'react-native';

const palette = {
  zinc: {
    50:  '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#0c0c0e',
  },
  amber: {
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
  },
};

const darkColors = {
  background:  palette.zinc[950],
  bg:          palette.zinc[950],
  surface:     '#141417',            // slightly warmer than zinc[900]
  surface2:    palette.zinc[800],
  border:      '#2a2a2e',            // subtle warm border
  text:        '#f0ece4',            // warm white, not stark
  textDim:     palette.zinc[500],
  textMuted:   palette.zinc[600],
  primary:     palette.amber[500],
  accent:      palette.amber[500],
  accentSoft:  '#2d2209',            // very dark amber tint for bg fills
  accentDim:   palette.amber[700],
  error:       '#f87171',
  red:         '#f87171',
  success:     '#4ade80',
  green:       '#4ade80',
  warning:     palette.amber[400],
  yellow:      palette.amber[400],
  info:        '#60a5fa',
  blue:        '#60a5fa',
  tint:        palette.amber[500],
  icon:        palette.zinc[400],
  tabIconDefault:  palette.zinc[600],
  tabIconSelected: palette.amber[400],
};

const lightColors = {
  background:  '#fdf9f3',            // warm off-white
  bg:          '#fdf9f3',
  surface:     '#f5f0e8',            // warm cream surface
  surface2:    '#ece6d8',
  border:      '#e0d8cb',            // warm border
  text:        '#1c1a17',            // warm near-black
  textDim:     '#7a736a',
  textMuted:   '#a09890',
  primary:     palette.amber[600],
  accent:      palette.amber[600],
  accentSoft:  '#fef3c7',            // light amber tint
  accentDim:   palette.amber[700],
  error:       '#dc2626',
  red:         '#dc2626',
  success:     '#16a34a',
  green:       '#16a34a',
  warning:     palette.amber[600],
  yellow:      palette.amber[600],
  info:        '#2563eb',
  blue:        '#2563eb',
  tint:        palette.amber[600],
  icon:        '#7a736a',
  tabIconDefault:  '#9e9890',
  tabIconSelected: palette.amber[600],
};

export const theme = {
  light: lightColors,
  dark: darkColors,
  colors: darkColors,
};

export const Colors = theme;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const Radius = {
  none: 0,
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 9999,
};

export const Fonts = Platform.select({
  ios: {
    sans:  'System',
    serif: 'Georgia',
    mono:  'Courier',
  },
  android: {
    sans:  'sans-serif',
    serif: 'serif',
    mono:  'monospace',
  },
  web: {
    sans:  'system-ui, -apple-system, sans-serif',
    serif: 'serif',
    mono:  'monospace',
  },
});

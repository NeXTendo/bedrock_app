import { Platform } from 'react-native';

const darkColors = {
  background: '#191D1A',
  bg: '#191D1A',
  surface: '#242A25',
  surface2: '#303831',
  border: '#3B463E',
  text: '#F5F1E9',
  textDim: '#B9BDB4',
  textMuted: '#B9BDB4',
  primary: '#9DBBA3',
  accent: '#88A991',
  accentSoft: '#2D3C31',
  accentDim: '#A9C3AC',
  highlight: '#E08A66',
  highlightSoft: '#49332B',
  error: '#DF8274',
  red: '#DF8274',
  success: '#92B79A',
  green: '#92B79A',
  warning: '#D5A45F',
  yellow: '#D5A45F',
  info: '#85AFB6',
  blue: '#85AFB6',
  tint: '#88A991',
  icon: '#B9BDB4',
  tabIconDefault: '#A3AAA1',
  tabIconSelected: '#C1D4C1',
  categoryRoads: '#E08068',
  categoryWater: '#79AEBB',
  categoryWaste: '#9FB878',
  categoryUtilities: '#D5A45F',
};

const lightColors = {
  background: '#F6F3EC',
  bg: '#F6F3EC',
  surface: '#FFFEFB',
  surface2: '#EEE9DF',
  border: '#E4DDD1',
  text: '#292E2A',
  textDim: '#6E736B',
  textMuted: '#6E736B',
  primary: '#315B47',
  accent: '#3F7057',
  accentSoft: '#E5EEE6',
  accentDim: '#315B47',
  highlight: '#B95F3E',
  highlightSoft: '#F5E7DE',
  error: '#B54F43',
  red: '#B54F43',
  success: '#487750',
  green: '#487750',
  warning: '#98631F',
  yellow: '#98631F',
  info: '#477782',
  blue: '#477782',
  tint: '#3F7057',
  icon: '#6E736B',
  tabIconDefault: '#85877F',
  tabIconSelected: '#315B47',
  categoryRoads: '#B65F4D',
  categoryWater: '#4C8290',
  categoryWaste: '#65834F',
  categoryUtilities: '#A8752D',
};

export const theme = {
  light: lightColors,
  dark: darkColors,
  colors: lightColors,
};

export const Colors = theme;

export function getCategoryColor(icon: string | null | undefined, colors: typeof lightColors): string {
  if (icon?.includes('car') || icon?.includes('road')) return colors.categoryRoads;
  if (icon?.includes('drop') || icon?.includes('water')) return colors.categoryWater;
  if (icon?.includes('trash') || icon?.includes('leaf')) return colors.categoryWaste;
  if (icon?.includes('bolt') || icon?.includes('light')) return colors.categoryUtilities;
  return colors.accent;
}

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

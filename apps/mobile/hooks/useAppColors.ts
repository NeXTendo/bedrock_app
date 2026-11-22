import { useColorScheme } from 'react-native';
import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function useAppColors() {
  const systemColorScheme = useColorScheme();
  const preferredTheme = useSettingsStore((state) => state.theme);
  const currentTheme = preferredTheme === 'auto'
    ? (systemColorScheme === 'dark' ? 'dark' : 'light')
    : preferredTheme;

  return theme[currentTheme];
}

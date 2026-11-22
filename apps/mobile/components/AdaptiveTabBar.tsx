import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Platform, 
  useColorScheme,
} from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IconSymbol } from './ui/icon-symbol';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

interface TabConfig {
  name: string;
  label: string;
  icon: string;
  isAction?: boolean;
}

const TAB_CONFIGS: Record<string, TabConfig> = {
  index: {
    name: 'index',
    label: 'Map',
    icon: 'map.fill',
  },
  services: {
    name: 'services',
    label: 'Services',
    icon: 'building.2.fill',
  },
  report: {
    name: 'report',
    label: 'Report',
    icon: 'plus',
    isAction: true,
  },
  explore: {
    name: 'explore',
    label: 'Explore',
    icon: 'paperplane.fill',
  },
  profile: {
    name: 'profile',
    label: 'Profile',
    icon: 'person.fill',
  },
};

function TabItem({ config, isFocused, onPress, colors, isDark }: {
  config: TabConfig;
  isFocused: boolean;
  onPress: () => void;
  colors: any;
  isDark: boolean;
}) {
  if (config.isAction) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.actionTab}
      >
        <View style={[styles.actionPill, { backgroundColor: colors.highlight, shadowColor: colors.highlight }]}>
          <IconSymbol name="plus" color={isDark ? '#0c0c0e' : '#fff'} size={20} />
        </View>
        <Text style={[styles.label, { color: colors.accent, fontWeight: '700' }]}>
          {config.label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tabItem}
    >
      <View style={[
        styles.iconPill,
        isFocused && { backgroundColor: colors.accentSoft },
      ]}>
        <IconSymbol
          name={config.icon as any}
          color={isFocused ? colors.accent : colors.tabIconDefault}
          size={19}
        />
      </View>
      <Text style={[
        styles.label,
        { 
          color: isFocused ? colors.accent : colors.tabIconDefault,
          fontWeight: isFocused ? '600' : '400',
        }
      ]}>
        {config.label}
      </Text>
    </TouchableOpacity>
  );
}

export function AdaptiveTabBar({ state, descriptors }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();

  const currentTheme = storeTheme === 'auto'
    ? (systemColorScheme || 'light')
    : storeTheme;

  const colors = theme[currentTheme as 'light' | 'dark'];
  const isDark = currentTheme === 'dark';
  const isIOS = Platform.OS === 'ios';

  const triggerHaptic = (style: 'light' | 'medium' = 'light') => {
    if (!hapticsEnabled) return;
    try {
      if (style === 'medium') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch {}
  };

  const handlePress = (route: typeof state.routes[0], isFocused: boolean) => {
    console.log('👉 [NavBar] Tap on tab:', route.name, 'isFocused:', isFocused);

    if (route.name === 'report') {
      triggerHaptic('medium');
      router.push('/report/create');
      return;
    }

    triggerHaptic('light');

    if (!isFocused) {
      const targetPath = route.name === 'index' ? '/(tabs)' : `/(tabs)/${route.name}`;
      console.log('👉 [NavBar] Navigating to:', targetPath);
      router.navigate(targetPath as any);
    }
  };

  const bottomPad = insets.bottom > 0 ? insets.bottom : 10;

  // ─── iOS: Floating pill ───────────────────────────────────────────────────
  if (isIOS) {
    return (
      <View style={[styles.iosWrapper, { bottom: bottomPad }]} pointerEvents="box-none">
        <View style={[
          styles.iosIsland,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }
        ]}>
          <View style={styles.tabRow}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;
              const config = TAB_CONFIGS[route.name] || {
                name: route.name,
                label: route.name,
                icon: 'questionmark',
              };
              return (
                <TabItem
                  key={route.key}
                  config={config}
                  isFocused={isFocused}
                  onPress={() => handlePress(route, isFocused)}
                  colors={colors}
                  isDark={isDark}
                />
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  // ─── Android ─────────────────────────────────────────────────────────────
  return (
    <View style={[
      styles.androidBar,
      {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        paddingBottom: bottomPad,
      }
    ]}>
      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIGS[route.name] || {
            name: route.name,
            label: route.name,
            icon: 'questionmark',
          };
          return (
            <TabItem
              key={route.key}
              config={config}
              isFocused={isFocused}
              onPress={() => handlePress(route, isFocused)}
              colors={colors}
              isDark={isDark}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* iOS island */
  iosWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  iosIsland: {
    width: '100%',
    height: 64,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      default: { elevation: 4 },
    }),
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },

  /* Shared tab items */
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  iconPill: {
    width: 42,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  actionTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  actionPill: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 5,
      },
      android: { elevation: 2 },
    }),
  },

  /* Android bar */
  androidBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 6,
    zIndex: 100,
    elevation: 10,
  },
});

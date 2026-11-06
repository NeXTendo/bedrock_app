import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Platform, 
  useColorScheme,
} from 'react-native';
import { Tabs } from 'expo-router';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue,
} from 'react-native-reanimated';

import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IconSymbol } from './ui/icon-symbol';

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
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 14, stiffness: 200 }) }],
  }));

  const handlePress = () => {
    scale.value = 0.85;
    setTimeout(() => { scale.value = 1; }, 100);
    onPress();
  };

  if (config.isAction) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={styles.actionTab}
      >
        <Animated.View style={[styles.actionPill, { backgroundColor: colors.accent }, animStyle]}>
          <IconSymbol name="plus" color={isDark ? '#0c0c0e' : '#fff'} size={20} />
        </Animated.View>
        <Text style={[styles.label, { color: colors.accent, fontWeight: '700' }]}>
          {config.label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={styles.tabItem}
    >
      <Animated.View style={[
        styles.iconPill,
        isFocused && { backgroundColor: colors.accentSoft },
        animStyle,
      ]}>
        <IconSymbol
          name={config.icon as any}
          color={isFocused ? colors.accent : colors.tabIconDefault}
          size={19}
        />
      </Animated.View>
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

export function AdaptiveTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
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
    if (style === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePress = (routeName: string, isFocused: boolean) => {
    if (routeName === 'report') {
      triggerHaptic('medium');
      navigation.navigate('report/create' as any);
      return;
    }

    triggerHaptic('light');

    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes.find((r) => r.name === routeName)?.key || '',
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
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
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
            backgroundColor: isDark ? 'rgba(14,13,12,0.82)' : 'rgba(253,249,243,0.88)',
          }
        ]}>
          <BlurView 
            intensity={80} 
            tint={isDark ? 'dark' : 'extraLight'} 
            style={StyleSheet.absoluteFill} 
          />
          {/* top gleam */}
          <View style={[
            styles.topGleam,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)' }
          ]} />

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
                  onPress={() => handlePress(route.name, isFocused)}
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
              onPress={() => handlePress(route.name, isFocused)}
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
    height: 62,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      default: { elevation: 8 },
    }),
  },
  topGleam: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 1,
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
    width: 40,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
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
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
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

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IconSymbol } from './ui/icon-symbol';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  onRightPress?: () => void;
  showBlur?: boolean;
  variant?: 'default' | 'floating';
}

export function AppHeader({
  title,
  subtitle,
  leftElement,
  rightElement,
  onRightPress,
  showBlur = false,
  variant = 'default',
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];
  const isFloating = variant === 'floating';

  const handleRightPress = () => {
    if (hapticsEnabled) {
      import('expo-haptics').then(Haptics => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      });
    }
    onRightPress?.();
  };

  return (
    <Animated.View 
      entering={FadeInDown.duration(300).springify()}
      style={[
        isFloating ? styles.floatingContainer : styles.dockedContainer,
        { 
          paddingTop: isFloating ? 10 : (insets.top + (Platform.OS === 'ios' ? 10 : 14)),
          marginTop: isFloating ? (insets.top + 8) : 0,
          marginHorizontal: isFloating ? 12 : 0,
          backgroundColor: isFloating 
            ? (showBlur ? 'transparent' : colors.surface) 
            : colors.background,
          borderRadius: isFloating ? 18 : 0,
          borderColor: colors.border,
          borderBottomWidth: isFloating ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }
      ]}
    >
      {isFloating && showBlur && (
        <BlurView 
          intensity={80} 
          tint={currentTheme === 'dark' ? 'dark' : 'light'} 
          style={StyleSheet.absoluteFill} 
        />
      )}
      <View style={styles.content}>
        <View style={styles.left}>
          {leftElement || (
            <View>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.textDim }]}>
                  {subtitle}
                </Text>
              ) : null}
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            </View>
          )}
        </View>
        <View style={styles.right}>
          {rightElement || (
            <TouchableOpacity 
              onPress={handleRightPress} 
              style={[styles.iconButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <IconSymbol name="gearshape.fill" color={colors.textDim} size={17} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dockedContainer: {
    position: 'relative',
    zIndex: 10,
  },
  floatingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#25291F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.09,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  left: {
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
    marginBottom: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

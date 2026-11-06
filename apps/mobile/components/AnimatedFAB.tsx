import React from 'react';
import { StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  ZoomIn, 
  ZoomOut 
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IconSymbol } from './ui/icon-symbol';

interface AnimatedFABProps {
  onPress: () => void;
  icon?: string;
  visible?: boolean;
  bottomOffset?: number;
}

export function AnimatedFAB({ 
  onPress, 
  icon = "plus", 
  visible = true,
  bottomOffset = 40 
}: AnimatedFABProps) {
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme } = useSettingsStore();
  
  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withSpring(visible ? 1 : 0, { damping: 15, stiffness: 150 }) }
      ],
      opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
    };
  });

  if (!visible) return null;

  return (
    <Animated.View 
      entering={ZoomIn.duration(400).springify()}
      exiting={ZoomOut.duration(300)}
      style={[
        styles.container,
        { bottom: bottomOffset }
      ]}
    >
      <Animated.View style={[styles.inner, animatedStyle, { backgroundColor: colors.primary }]}>
        <TouchableOpacity 
          onPress={onPress} 
          style={styles.button}
          activeOpacity={0.8}
        >
          <IconSymbol 
            name={icon as any} 
            color={currentTheme === 'dark' ? colors.background : colors.background} 
            size={28} 
          />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    width: 64,
    height: 64,
    zIndex: 10,
  },
  inner: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

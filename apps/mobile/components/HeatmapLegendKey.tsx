import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  Platform,
  Animated,
} from 'react-native';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useHeatmapStore, HeatmapType } from '@/stores/useHeatmapStore';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

interface LegendConfig {
  title: string;
  subtext: string;
  icon: string;
  iconColor: string;
  gradientColors: [string, string, ...string[]];
}

const LEGEND_CONFIGS: Record<HeatmapType, LegendConfig> = {
  overall: {
    title: 'Overall',
    subtext: 'All Issues',
    icon: 'flame.fill',
    iconColor: '#FF6B6B',
    gradientColors: ['#FF3B30', '#FF9500', '#34C759', '#007AFF'],
  },
  roads: {
    title: 'Roads',
    subtext: 'Potholes & Safety',
    icon: 'car.fill',
    iconColor: '#E53935',
    gradientColors: ['#B71C1C', '#E53935', '#EF5350'],
  },
  water: {
    title: 'Water',
    subtext: 'Leaks & Sanitation',
    icon: 'drop.fill',
    iconColor: '#1E88E5',
    gradientColors: ['#0D47A1', '#1E88E5', '#64B5F6'],
  },
  waste: {
    title: 'Waste',
    subtext: 'Trash & Dumping',
    icon: 'trash.fill',
    iconColor: '#43A047',
    gradientColors: ['#1B5E20', '#43A047', '#81C784'],
  },
  power: {
    title: 'Utilities',
    subtext: 'Lights & Power',
    icon: 'bolt.fill',
    iconColor: '#FFA000',
    gradientColors: ['#E65100', '#FF8F00', '#FFD54F'],
  },
};

export function HeatmapLegendKey({ 
  bottomOffset = 20, 
  visible = true 
}: { 
  bottomOffset?: number;
  visible?: boolean;
}) {
  const systemColorScheme = useColorScheme();
  const currentTheme: 'light' | 'dark' = systemColorScheme === 'dark' ? 'dark' : 'light';
  const colors = theme[currentTheme];

  const {
    heatmapVisible,
    heatmapType,
    hasSeenOnboarding,
    toggleHeatmap,
    cycleHeatmapType,
    setOnboardingModalVisible,
  } = useHeatmapStore();

  const activeConfig = LEGEND_CONFIGS[heatmapType];

  // Animation values for smooth entrance, exit, and slide shifts
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: visible ? 280 : 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: visible ? 0 : -55, // Shift 55px to the left (off-screen)
        duration: visible ? 300 : 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, fadeAnim, slideAnim]);

  const handleKeyClick = () => {
    if (!hasSeenOnboarding) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setOnboardingModalVisible(true);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      cycleHeatmapType();
    }
  };

  const handleToggle = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleHeatmap();
  };

  const handleLongPress = () => {
    // Re-trigger onboarding modal via long-press
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOnboardingModalVisible(true);
  };

  return (
    <Animated.View 
      style={[
        styles.floatingContainer, 
        { 
          bottom: bottomOffset,
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }]
        }
      ]}
    >
      <TouchableOpacity 
        activeOpacity={0.88} 
        onPress={handleKeyClick} 
        onLongPress={handleLongPress}
        style={[
          styles.thermometerContainer,
          { 
            borderColor: colors.border,
            backgroundColor: Platform.OS === 'android' ? colors.surface : 'transparent'
          }
        ]}
      >
        {Platform.OS === 'ios' && (
          <BlurView intensity={85} tint={currentTheme} style={StyleSheet.absoluteFill} />
        )}
        
        {/* Top Bulb: Active Category Indicator */}
        <View style={[
          styles.bulbTop, 
          { 
            backgroundColor: activeConfig.iconColor + '18',
            borderColor: activeConfig.iconColor + '50'
          }
        ]}>
          <IconSymbol name={activeConfig.icon as any} size={15} color={activeConfig.iconColor} />
        </View>

        {/* Thermometer Tube */}
        <View style={styles.tubeContainer}>
          <Text style={[styles.indicatorText, { color: colors.text }]}>H</Text>
          
          <LinearGradient
            colors={activeConfig.gradientColors}
            style={styles.gradientTube}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          
          <Text style={[styles.indicatorText, { color: colors.textDim }]}>L</Text>
        </View>

        {/* Separator before visibility toggle */}
        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Bottom Bulb: Visibility Toggle */}
        <TouchableOpacity
          onPress={handleToggle}
          style={[
            styles.bulbBottom,
            { backgroundColor: heatmapVisible ? activeConfig.iconColor + '20' : colors.surface2 }
          ]}
          activeOpacity={0.7}
        >
          <IconSymbol
            name={heatmapVisible ? "eye.fill" : "eye.slash.fill"}
            size={14}
            color={heatmapVisible ? activeConfig.iconColor : colors.textDim}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 99,
  },
  thermometerContainer: {
    width: 38,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  bulbTop: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  tubeContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  indicatorText: {
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  gradientTube: {
    width: 7,
    height: 85,
    borderRadius: 3.5,
  },
  separator: {
    width: 18,
    height: 1,
    marginVertical: 6,
  },
  bulbBottom: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

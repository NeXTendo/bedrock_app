import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  useColorScheme,
  Platform,
} from 'react-native';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useHeatmapStore } from '@/stores/useHeatmapStore';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

export function HeatmapOnboardingModal() {
  const systemColorScheme = useColorScheme();
  
  const { 
    onboardingModalVisible, 
    setOnboardingModalVisible, 
    setHasSeenOnboarding,
    toggleHeatmap
  } = useHeatmapStore();

  const currentTheme: 'light' | 'dark' = systemColorScheme === 'dark' ? 'dark' : 'light';
  const colors = theme[currentTheme];

  const [currentPage, setCurrentPage] = useState(0);

  const pages = [
    {
      title: 'Spatial Heatmaps',
      subtitle: 'Visualize Community Activity',
      description: 'The heatmap overlay maps community reports in real time, revealing spatial patterns, densities, and high-frequency problem areas that require direct focus.',
      icon: 'flame.fill',
      iconColor: '#FF6B6B',
      bgGlow: 'rgba(255, 107, 107, 0.1)',
      illustration: (
        <View style={styles.illContainer}>
          <View style={[styles.illCircle, { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255, 107, 107, 0.1)' }]} />
          <View style={[styles.illCircle, { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255, 107, 107, 0.2)' }]} />
          <View style={[styles.illCircle, { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255, 107, 107, 0.45)', justifyContent: 'center', alignItems: 'center' }]}>
            <IconSymbol name="flame.fill" size={24} color="#FFF" />
          </View>
        </View>
      ),
    },
    {
      title: 'Intensity Scale',
      subtitle: 'Reading the Gradient Key',
      description: 'The vertical floating scale key shows report concentration. Cool, faint colors indicate isolated issues, while intense bright centers denote critical density hotspots.',
      icon: 'layers.fill',
      iconColor: '#4D96FF',
      bgGlow: 'rgba(77, 150, 255, 0.1)',
      illustration: (
        <View style={styles.illContainer}>
          <View style={styles.diagramRow}>
            {/* Legend diagram mock */}
            <View style={[styles.diagramLegend, { borderColor: colors.border }]}>
              <View style={[styles.diagramGradientStrip, { backgroundColor: '#FF6B6B' }]} />
              <View style={[styles.diagramGradientStrip, { backgroundColor: '#FFB84C' }]} />
              <View style={[styles.diagramGradientStrip, { backgroundColor: '#4D96FF' }]} />
            </View>
            <View style={styles.diagramLabels}>
              <View style={styles.diagramLabelItem}>
                <Text style={[styles.diagramText, { color: colors.text }]}>High Intensity</Text>
                <Text style={[styles.diagramSubText, { color: colors.textDim }]}>Dense report clusters</Text>
              </View>
              <View style={styles.diagramLabelItem}>
                <Text style={[styles.diagramText, { color: colors.text }]}>Low Intensity</Text>
                <Text style={[styles.diagramSubText, { color: colors.textDim }]}>Scattered reports</Text>
              </View>
            </View>
          </View>
        </View>
      ),
    },
    {
      title: 'Cycle & Filter',
      subtitle: 'Isolate Infrastructural Stress',
      description: 'Tap the legend key itself to cycle between Overall Density, Roads & Potholes, Water & Sanitation, Waste, or Electrical hazards to study specific urban demands.',
      icon: 'map.fill',
      iconColor: '#6BCB77',
      bgGlow: 'rgba(107, 203, 119, 0.1)',
      illustration: (
        <View style={styles.illContainer}>
          <View style={styles.cycleGrid}>
            <View style={[styles.cycleBadge, { backgroundColor: colors.surface2 }]}>
              <IconSymbol name="car.fill" size={16} color="#E53935" />
              <Text style={[styles.cycleBadgeText, { color: colors.text }]}>Roads</Text>
            </View>
            <View style={[styles.cycleBadge, { backgroundColor: colors.surface2 }]}>
              <IconSymbol name="drop.fill" size={16} color="#1E88E5" />
              <Text style={[styles.cycleBadgeText, { color: colors.text }]}>Water</Text>
            </View>
            <View style={[styles.cycleBadge, { backgroundColor: colors.surface2 }]}>
              <IconSymbol name="trash.fill" size={16} color="#43A047" />
              <Text style={[styles.cycleBadgeText, { color: colors.text }]}>Waste</Text>
            </View>
            <View style={[styles.cycleBadge, { backgroundColor: colors.surface2 }]}>
              <IconSymbol name="bolt.fill" size={16} color="#FFA000" />
              <Text style={[styles.cycleBadgeText, { color: colors.text }]}>Utilities</Text>
            </View>
          </View>
          <View style={[styles.cycleGlowCircle, { backgroundColor: 'rgba(107, 203, 119, 0.15)' }]} />
        </View>
      ),
    },
  ];

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHasSeenOnboarding(true);
    setOnboardingModalVisible(false);
    toggleHeatmap(); // Turn on heatmap automatically as they finish onboarding
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleComplete();
  };

  return (
    <Modal
      visible={onboardingModalVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setOnboardingModalVisible(false)}
    >
      <View style={styles.overlay}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={70} tint={currentTheme} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: currentTheme === 'dark' ? 'rgba(9, 9, 11, 0.92)' : 'rgba(250, 250, 250, 0.95)' }]} />
        )}
        
        <View style={[styles.modalContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={[styles.skipText, { color: colors.textDim }]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setOnboardingModalVisible(false);
              }}
              style={[styles.closeButton, { backgroundColor: colors.surface2 }]}
            >
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.pageContent}>
            {pages[currentPage].illustration}

            <View style={[styles.badgeContainer, { backgroundColor: pages[currentPage].bgGlow }]}>
              <IconSymbol name={pages[currentPage].icon as any} size={14} color={pages[currentPage].iconColor} />
              <Text style={[styles.badgeText, { color: pages[currentPage].iconColor }]}>
                {pages[currentPage].subtitle}
              </Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              {pages[currentPage].title}
            </Text>

            <Text style={[styles.description, { color: colors.textDim }]}>
              {pages[currentPage].description}
            </Text>
          </View>

          {/* Footer Navigation */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {/* Dots */}
            <View style={styles.dotsContainer}>
              {pages.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    { 
                      backgroundColor: currentPage === index 
                        ? colors.text 
                        : colors.border,
                      width: currentPage === index ? 16 : 6,
                    }
                  ]}
                />
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.navButtons}>
              {currentPage > 0 && (
                <TouchableOpacity
                  onPress={handleBack}
                  style={[styles.navButton, styles.backButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.buttonText, { color: colors.text }]}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleNext}
                style={[
                  styles.navButton, 
                  styles.nextButton, 
                  { 
                    backgroundColor: colors.text,
                    flex: currentPage === 0 ? 1 : undefined
                  }
                ]}
              >
                <Text style={[styles.buttonText, { color: colors.background, fontWeight: '600' }]}>
                  {currentPage === pages.length - 1 ? 'Get Started' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  illContainer: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  illCircle: {
    position: 'absolute',
  },
  diagramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  diagramLegend: {
    width: 16,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  diagramGradientStrip: {
    flex: 1,
    width: '100%',
  },
  diagramLabels: {
    justifyContent: 'space-between',
    height: 100,
    paddingVertical: 4,
  },
  diagramLabelItem: {
    justifyContent: 'center',
  },
  diagramText: {
    fontSize: 13,
    fontWeight: '600',
  },
  diagramSubText: {
    fontSize: 11,
  },
  cycleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 160,
    zIndex: 2,
  },
  cycleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  cycleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cycleGlowCircle: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    zIndex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  navButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  backButton: {
    borderWidth: 1,
  },
  nextButton: {},
  buttonText: {
    fontSize: 13,
  },
});

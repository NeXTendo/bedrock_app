import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IconSymbol } from './ui/icon-symbol';
import * as Haptics from 'expo-haptics';

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControl({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlProps) {
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();

  const currentTheme = storeTheme === 'auto'
    ? (systemColorScheme || 'light')
    : storeTheme;

  const colors = theme[currentTheme as 'light' | 'dark'];

  if (totalPages <= 1) return null;

  const handlePrev = () => {
    if (currentPage > 1) {
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPageChange(currentPage + 1);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePrev}
        disabled={currentPage === 1}
        style={[
          styles.arrowBtn,
          { backgroundColor: colors.surface2, opacity: currentPage === 1 ? 0.4 : 1 },
        ]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <IconSymbol name="chevron.left" color={colors.text} size={14} />
      </TouchableOpacity>

      <View style={styles.pageInfo}>
        <Text style={[styles.pageIndicator, { color: colors.text }]}>
          Page {currentPage}
        </Text>
        <Text style={[styles.pageTotal, { color: colors.textDim }]}>
          of {totalPages}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleNext}
        disabled={currentPage === totalPages}
        style={[
          styles.arrowBtn,
          { backgroundColor: colors.surface2, opacity: currentPage === totalPages ? 0.4 : 1 },
        ]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <IconSymbol name="chevron.right" color={colors.text} size={14} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  arrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageIndicator: {
    fontSize: 14,
    fontWeight: '600',
  },
  pageTotal: { fontSize: 14, fontWeight: '500' },
});

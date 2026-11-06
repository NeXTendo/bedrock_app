import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IconSymbol } from './ui/icon-symbol';
import * as Haptics from 'expo-haptics';

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PaginationControl({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationControlProps) {
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();

  const currentTheme = storeTheme === 'auto'
    ? (systemColorScheme || 'light')
    : storeTheme;

  const colors = theme[currentTheme as 'light' | 'dark'];

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

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
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={handlePrev}
        disabled={currentPage === 1}
        style={[
          styles.arrowBtn,
          { 
            backgroundColor: currentPage === 1 ? 'transparent' : colors.surface2,
            borderColor: colors.border,
            opacity: currentPage === 1 ? 0.4 : 1
          }
        ]}
        activeOpacity={0.7}
      >
        <IconSymbol name="chevron.left" color={colors.text} size={14} />
      </TouchableOpacity>

      <View style={styles.centerInfo}>
        <Text style={[styles.pageIndicator, { color: colors.text }]}>
          PAGE {currentPage} OF {totalPages}
        </Text>
        <Text style={[styles.itemRange, { color: colors.textDim }]}>
          Showing {startItem}–{endItem} of {totalItems}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleNext}
        disabled={currentPage === totalPages}
        style={[
          styles.arrowBtn,
          { 
            backgroundColor: currentPage === totalPages ? 'transparent' : colors.surface2,
            borderColor: colors.border,
            opacity: currentPage === totalPages ? 0.4 : 1
          }
        ]}
        activeOpacity={0.7}
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
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 10,
  },
  arrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerInfo: {
    alignItems: 'center',
  },
  pageIndicator: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  itemRange: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
});

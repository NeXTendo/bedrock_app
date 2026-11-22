import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface CategoryPillProps {
  label: string;
  icon?: string;
  isActive: boolean;
  onPress: () => void;
}

export function CategoryPill({ label, icon, isActive, onPress }: CategoryPillProps) {
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme } = useSettingsStore();
  const currentTheme = storeTheme === 'auto' ? (systemColorScheme || 'light') : storeTheme;
  const colors = theme[currentTheme as 'light' | 'dark'];

  return (
    <TouchableOpacity
      style={[
        styles.pill,
        isActive
          ? { backgroundColor: colors.highlightSoft, borderColor: 'transparent' }
          : { backgroundColor: colors.surface, borderColor: 'transparent' },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {icon && (
        <IconSymbol 
          name={icon as any} 
          size={13} 
          color={isActive ? colors.highlight : colors.textDim}
        />
      )}
      <Text style={[styles.label, { color: isActive ? colors.highlight : colors.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});

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
  color?: string;
}

export function CategoryPill({ label, icon, isActive, onPress, color }: CategoryPillProps) {
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme } = useSettingsStore();
  const currentTheme = storeTheme === 'auto' ? (systemColorScheme || 'light') : storeTheme;
  const colors = theme[currentTheme as 'light' | 'dark'];

  const activeColor = color || colors.accent;

  return (
    <TouchableOpacity
      style={[
        styles.pill,
        isActive
          ? { backgroundColor: activeColor + '22', borderColor: activeColor }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {icon && (
        <IconSymbol 
          name={icon as any} 
          size={13} 
          color={isActive ? activeColor : colors.textDim}
        />
      )}
      <Text style={[styles.label, { color: isActive ? activeColor : colors.textDim }]}>
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});

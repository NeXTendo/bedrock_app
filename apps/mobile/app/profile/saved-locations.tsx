import { StyleSheet, View, Text, FlatList, TouchableOpacity, useColorScheme } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { AppHeader } from '@/components/AppHeader';

export default function SavedLocationsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];

  const { data: locations, isLoading, refetch } = useQuery({
    queryKey: ['saved-locations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardInfo}>
        <View style={[styles.iconContainer, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <IconSymbol name="mappin.circle.fill" color={colors.accent} size={18} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.locationName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.locationAddress, { color: colors.textDim }]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        style={[styles.actionBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
        activeOpacity={0.7}
      >
        <IconSymbol name="chevron.right" color={colors.textDim} size={14} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader 
        title="Saved Locations"
        subtitle="PERSONAL WATCH AREAS"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <IconSymbol name="chevron.left" color={colors.text} size={20} />
          </TouchableOpacity>
        }
        rightElement={
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
            <IconSymbol name="plus.circle.fill" color="#FFFFFF" size={16} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={locations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingTop: 14, paddingBottom: 40 }]}
        onRefresh={refetch}
        refreshing={isLoading}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="mappin.and.ellipse" color={colors.surface2} size={48} />
            <Text style={[styles.emptyText, { color: colors.textDim }]}>No saved locations recorded.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 8,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  locationAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
    opacity: 0.5,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '600',
  },
});

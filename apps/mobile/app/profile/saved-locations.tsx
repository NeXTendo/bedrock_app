import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { useAppColors } from '@/hooks/useAppColors';

export default function SavedLocationsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const colors = useAppColors();

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
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 0,
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
    borderRadius: 12,
    borderWidth: 0,
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
    borderRadius: 12,
    borderWidth: 0,
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

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

export default function SubmissionHistoryScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['user-reports', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          report_photos (image_url),
          categories (name, icon, color)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/report/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.categoryInfo}>
          <View style={[styles.iconContainer, { backgroundColor: (item.categories?.color || colors.accent) + '20' }]}>
            <IconSymbol name={(item.categories?.icon || 'paperplane.fill') as any} color={item.categories?.color || colors.accent} size={16} />
          </View>
          <Text style={[styles.categoryName, { color: colors.text }]}>{item.categories?.name || 'Issue'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, colors) + '15' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status, colors) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={[styles.description, { color: colors.text }]} numberOfLines={2}>
        {item.description || 'No description provided.'}
      </Text>

      <View style={styles.cardFooter}>
        <View style={styles.locationInfo}>
          <IconSymbol name="location.fill" color={colors.textDim} size={12} />
          <Text style={[styles.locationText, { color: colors.textDim }]} numberOfLines={1}>{item.address}</Text>
        </View>
        <Text style={[styles.dateText, { color: colors.textDim }]}>
          {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader 
        title="Submission History"
        subtitle="OFFICIAL RECORDS"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" color={colors.text} size={24} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={reports}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingTop: 14, paddingBottom: 40 }]}
        onRefresh={refetch}
        refreshing={isLoading}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="list.bullet" color={colors.surface2} size={48} />
            <Text style={[styles.emptyText, { color: colors.textDim }]}>No official records found.</Text>
          </View>
        }
      />
    </View>
  );
}

const getStatusColor = (status: string, colors: any) => {
  const s = status?.toUpperCase();
  switch (s) {
    case 'NEW': return colors.textDim;
    case 'VERIFIED': return colors.info;
    case 'ASSIGNED':
    case 'IN_PROGRESS': return colors.warning;
    case 'RESOLVED': return colors.success;
    case 'REJECTED': return colors.error;
    default: return colors.textDim;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 12,
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
    opacity: 0.5,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
});

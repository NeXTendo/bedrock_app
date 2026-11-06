import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  FlatList, 
  TextInput, 
  ActivityIndicator, 
  useColorScheme 
} from 'react-native';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryPill } from '@/components/CategoryPill';
import { ReportCard } from '@/components/ReportCard';
import { PaginationControl } from '@/components/PaginationControl';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLocation } from '@/hooks/useLocation';
import { ExploreHighlights } from '@/components/ExploreHighlights';

const PAGE_SIZE = 6;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'trending' | 'nearby'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'resolved'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();
  const { location: userLocation } = useLocation();

  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryId, searchQuery, sortBy, statusFilter]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['community-stats'],
    queryFn: async () => {
      const { count: totalReports } = await supabase.from('reports').select('*', { count: 'exact', head: true });
      const { count: resolvedCount } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'resolved');
      const { count: activeUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      
      return {
        total_reports: totalReports || 0,
        resolved_today: resolvedCount || 0,
        active_users: activeUsers || 0,
      };
    }
  });

  const { data: criticalReports } = useQuery({
    queryKey: ['critical-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          id,
          description,
          address,
          status,
          categories (name, icon, color),
          report_photos (image_url)
        `)
        .order('confirmation_count', { ascending: false })
        .limit(4);
      if (error) throw error;
      return data as any[];
    }
  });

  const { data: contributors } = useQuery({
    queryKey: ['explore-top-citizens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, xp_points')
        .order('xp_points', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    }
  });

  const { data: reports, isLoading: reportsLoading, isRefetching, refetch } = useQuery({
    queryKey: ['explore-reports', selectedCategoryId, searchQuery, sortBy, statusFilter, userLocation?.coords.latitude],
    queryFn: async () => {
      let query = supabase
        .from('reports')
        .select(`
          *,
          categories (*),
          report_photos (image_url)
        `);

      if (selectedCategoryId) {
        query = query.eq('category_id', selectedCategoryId);
      }

      if (statusFilter === 'resolved') {
        query = query.eq('status', 'resolved');
      } else {
        query = query.neq('status', 'resolved');
      }

      if (searchQuery) {
        query = query.or(`description.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`);
      }

      if (sortBy === 'trending') {
        query = query.order('confirmation_count', { ascending: false });
      } else if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;

      let processedData = data;
      
      if (sortBy === 'nearby' && userLocation) {
        processedData = [...data].sort((a, b) => {
          const distA = Math.sqrt(
            Math.pow(a.latitude - userLocation.coords.latitude, 2) + 
            Math.pow(a.longitude - userLocation.coords.longitude, 2)
          );
          const distB = Math.sqrt(
            Math.pow(b.latitude - userLocation.coords.latitude, 2) + 
            Math.pow(b.longitude - userLocation.coords.longitude, 2)
          );
          return distA - distB;
        });
      }

      return processedData;
    },
  });

  const totalReportsCount = reports?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalReportsCount / PAGE_SIZE));
  const paginatedReports = (reports || []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleRefresh = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refetch();
  };

  const SORT_OPTIONS: { key: 'newest' | 'trending' | 'nearby'; label: string; icon: string }[] = [
    { key: 'newest',   label: 'Newest',   icon: 'clock' },
    { key: 'trending', label: 'Trending', icon: 'flame.fill' },
    { key: 'nearby',   label: 'Nearby',   icon: 'location.fill' },
  ];

  const renderHeader = () => {
    const total = stats?.total_reports || 0;
    const resolved = stats?.resolved_today || 0;
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return (
      <View style={styles.header}>
        {/* Page title */}
        <Text style={[styles.pageTitle, { color: colors.text }]}>Explore</Text>

        {/* Critical reports highlights */}
        <ExploreHighlights reports={criticalReports || []} />

        {/* City stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statsHeader}>
            <View style={[styles.statsDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.statsTitle, { color: colors.textDim }]}>City overview</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stats?.total_reports ?? '—'}</Text>
              <Text style={[styles.statLabel, { color: colors.textDim }]}>Total filed</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.success }]}>{stats?.resolved_today ?? '—'}</Text>
              <Text style={[styles.statLabel, { color: colors.textDim }]}>Resolved</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.accent }]}>{rate}%</Text>
              <Text style={[styles.statLabel, { color: colors.textDim }]}>Efficiency</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stats?.active_users ?? '—'}</Text>
              <Text style={[styles.statLabel, { color: colors.textDim }]}>Citizens</Text>
            </View>
          </View>
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" color={colors.textDim} size={15} />
          <TextInput
            placeholder="Search by description or street..."
            placeholderTextColor={colors.textDim}
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" color={colors.textDim} size={15} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category pills */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        >
          <CategoryPill
            label="All"
            icon="square.grid.2x2.fill"
            isActive={selectedCategoryId === null}
            onPress={() => setSelectedCategoryId(null)}
          />
          {categories?.map((cat) => (
            <CategoryPill
              key={cat.id}
              label={cat.name}
              icon={cat.icon}
              isActive={selectedCategoryId === cat.id}
              onPress={() => setSelectedCategoryId(cat.id)}
              color={cat.color}
            />
          ))}
        </ScrollView>

        {/* Status + Sort row */}
        <View style={styles.filterRow}>
          {/* Status toggle */}
          <View style={[styles.statusToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.toggleBtn, statusFilter === 'all' && [styles.toggleBtnActive, { backgroundColor: colors.accentSoft }]]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.toggleText, { color: statusFilter === 'all' ? colors.accent : colors.textDim }]}>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, statusFilter === 'resolved' && [styles.toggleBtnActive, { backgroundColor: colors.accentSoft }]]}
              onPress={() => setStatusFilter('resolved')}
            >
              <Text style={[styles.toggleText, { color: statusFilter === 'resolved' ? colors.accent : colors.textDim }]}>Resolved</Text>
            </TouchableOpacity>
          </View>

          {/* Sort cycle button */}
          <TouchableOpacity 
            style={[styles.sortBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (sortBy === 'newest') setSortBy('trending');
              else if (sortBy === 'trending') setSortBy('nearby');
              else setSortBy('newest');
            }}
          >
            <IconSymbol 
              name={SORT_OPTIONS.find(s => s.key === sortBy)?.icon as any || 'clock'} 
              color={colors.accent} 
              size={13} 
            />
            <Text style={[styles.sortText, { color: colors.accent }]}>
              {SORT_OPTIONS.find(s => s.key === sortBy)?.label}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>
          {totalReportsCount} {totalReportsCount === 1 ? 'report' : 'reports'}
        </Text>
      </View>
    );
  };

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalReportsCount}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      {contributors && contributors.length > 0 && (
        <View style={styles.leaderboardSection}>
          <Text style={[styles.leaderboardTitle, { color: colors.text }]}>Top observers</Text>
          {contributors.map((user, i) => (
            <View key={user.id} style={[styles.leaderboardItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[
                styles.rankBadge,
                { backgroundColor: i === 0 ? colors.accent : colors.surface2 }
              ]}>
                <Text style={[styles.rankText, { color: i === 0 ? colors.background : colors.textDim }]}>{i + 1}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.text }]}>{user.full_name || 'Citizen'}</Text>
                <Text style={[styles.userXp, { color: colors.textDim }]}>{user.xp_points || 0} XP</Text>
              </View>
              <IconSymbol name="bolt.fill" color={colors.accent} size={13} />
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        key="explore-2-col-grid"
        data={paginatedReports}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReportCard report={item} userLocation={userLocation} variant="grid" />
        )}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        refreshing={isRefetching}
        onRefresh={handleRefresh}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 }
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          reportsLoading ? (
            <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol name="magnifyingglass" color={colors.surface2} size={44} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No reports found</Text>
              <Text style={[styles.emptySubtext, { color: colors.textDim }]}>Try adjusting your filters or search.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 12 },
  columnWrapper: { justifyContent: 'space-between' },

  header: { marginBottom: 12 },

  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 16,
    paddingHorizontal: 2,
  },

  statsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  statsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 22,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },

  categoriesList: {
    paddingBottom: 4,
    paddingHorizontal: 2,
    gap: 6,
    marginBottom: 10,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statusToggle: {
    flexDirection: 'row',
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 7,
  },
  toggleBtnActive: {},
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
    marginLeft: 2,
  },

  footerContainer: { marginTop: 8 },

  leaderboardSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  leaderboardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  userXp: {
    fontSize: 12,
    marginTop: 1,
  },

  emptyState: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 14,
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});

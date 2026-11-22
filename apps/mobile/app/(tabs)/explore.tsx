import React, { useState } from 'react';
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

const PAGE_SIZE = 6;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'trending' | 'nearby'>('newest');
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved'>('active');
  const [currentPage, setCurrentPage] = useState(1);

  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();
  const { location: userLocation } = useLocation();

  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];

  const updateCategory = (categoryId: string | null) => {
    if (selectedCategoryId === categoryId) return;
    setSelectedCategoryId(categoryId);
    setCurrentPage(1);
  };

  const updateSearch = (query: string) => {
    if (searchQuery === query) return;
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const updateSort = (sort: typeof sortBy) => {
    if (sortBy === sort) return;
    setSortBy(sort);
    setCurrentPage(1);
  };

  const updateStatusFilter = (status: typeof statusFilter) => {
    if (statusFilter === status) return;
    setStatusFilter(status);
    setCurrentPage(1);
  };

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
        query = query.ilike('status', 'resolved');
      } else {
        query = query
          .not('status', 'ilike', 'resolved')
          .not('status', 'ilike', 'rejected');
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
    return (
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Explore</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textDim }]}>
            Find and follow reports in your community.
          </Text>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" color={colors.textDim} size={15} />
          <TextInput
            placeholder="Search reports"
            placeholderTextColor={colors.textDim}
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={updateSearch}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => updateSearch('')}>
              <IconSymbol name="xmark.circle.fill" color={colors.textDim} size={15} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.filterGroupLabel, { color: colors.textDim }]}>Categories</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        >
          <CategoryPill
            label="All"
            icon="square.grid.2x2.fill"
            isActive={selectedCategoryId === null}
            onPress={() => updateCategory(null)}
          />
          {categories?.map((cat) => (
            <CategoryPill
              key={cat.id}
              label={cat.name}
              icon={cat.icon}
              isActive={selectedCategoryId === cat.id}
              onPress={() => updateCategory(cat.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.filterRow}>
          <View style={[styles.statusToggle, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.toggleBtn, statusFilter === 'active' && [styles.toggleBtnActive, { backgroundColor: colors.accentSoft }]]}
              onPress={() => updateStatusFilter('active')}
              accessibilityRole="button"
              accessibilityState={{ selected: statusFilter === 'active' }}
            >
              <Text style={[styles.toggleText, { color: statusFilter === 'active' ? colors.accent : colors.textDim }]}>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, statusFilter === 'resolved' && [styles.toggleBtnActive, { backgroundColor: colors.accentSoft }]]}
              onPress={() => updateStatusFilter('resolved')}
              accessibilityRole="button"
              accessibilityState={{ selected: statusFilter === 'resolved' }}
            >
              <Text style={[styles.toggleText, { color: statusFilter === 'resolved' ? colors.accent : colors.textDim }]}>Resolved</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.sortBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (sortBy === 'newest') updateSort('trending');
              else if (sortBy === 'trending') updateSort('nearby');
              else updateSort('newest');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Sort reports by ${SORT_OPTIONS.find(s => s.key === sortBy)?.label}`}
            accessibilityHint="Tap to change the report sorting"
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

        <View style={styles.resultsHeader}>
          <View>
            <Text style={[styles.resultsTitle, { color: colors.text }]}>
              {statusFilter === 'active' ? 'Active reports' : 'Resolved reports'}
            </Text>
            <Text style={[styles.resultsSubtitle, { color: colors.textDim }]}>
              {totalReportsCount} {totalReportsCount === 1 ? 'report' : 'reports'} found
            </Text>
          </View>
          <View style={[styles.sortBadge, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.sortBadgeText, { color: colors.accent }]}>
              {SORT_OPTIONS.find(s => s.key === sortBy)?.label}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        key="explore-report-list"
        data={paginatedReports}
        numColumns={1}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReportCard report={item} userLocation={userLocation} />
        )}
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
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textDim }]}>Loading reports…</Text>
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
                <IconSymbol name="magnifyingglass" color={colors.accent} size={24} />
              </View>
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
  listContent: { paddingHorizontal: 18 },
  header: { marginBottom: 10 },

  titleBlock: { marginBottom: 16 },
  pageTitle: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    paddingHorizontal: 12,
    height: 50,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },

  filterGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoriesList: {
    paddingBottom: 6,
    paddingHorizontal: 2,
    gap: 8,
    marginBottom: 14,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusToggle: {
    flexDirection: 'row',
    flex: 1,
    borderRadius: 13,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  toggleBtnActive: {},
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 13,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  resultsTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  resultsSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sortBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sortBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  footerContainer: { marginTop: 8 },

  emptyState: {
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderWidth: 1,
    borderRadius: 18,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 44,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});

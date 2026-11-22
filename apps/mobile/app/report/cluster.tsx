import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Platform,
  useColorScheme,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useHeatmapStore } from '@/stores/useHeatmapStore';
import { ReportCard } from '@/components/ReportCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLocation } from '@/hooks/useLocation';
import { PaginationControl } from '@/components/PaginationControl';

/** Map heatmap category keys to display icons */
const CATEGORY_ICONS: Record<string, string> = {
  overall: 'flame.fill',
  roads: 'car.fill',
  water: 'drop.fill',
  waste: 'trash.fill',
  power: 'bolt.fill',
};

const PAGE_SIZE = 6; // 3 rows of 2 columns

export default function ClusterDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();

  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();
  const { location: userLocation } = useLocation();
  const { selectedClusterReports, selectedClusterMeta } = useHeatmapStore();

  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'resolved'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFollowing, setIsFollowing] = useState(false);

  const currentTheme = storeTheme === 'auto'
    ? (systemColorScheme || 'light')
    : storeTheme;
  const colors = theme[currentTheme as 'light' | 'dark'];

  const accentColor = selectedClusterMeta?.color || colors.accent;
  const clusterTitle = selectedClusterMeta?.title || 'Incident Hotspot';
  const totalCount = selectedClusterReports.length;
  const categoryKey = (clusterTitle.toLowerCase() as keyof typeof CATEGORY_ICONS);
  const categoryIcon = CATEGORY_ICONS[categoryKey] ?? 'flame.fill';

  // Metrics computation
  const metrics = useMemo(() => {
    let resolved = 0;
    let inProgress = 0;
    let openCount = 0;
    let totalConfirmations = 0;
    const categoryCountMap: Record<string, number> = {};

    selectedClusterReports.forEach((r) => {
      const status = r.status?.toLowerCase();
      if (status === 'resolved') resolved++;
      else if (status === 'in_progress' || status === 'assigned') inProgress++;
      else openCount++;

      totalConfirmations += (r.confirmation_count || 1);

      const catName = r.categories?.name || 'General';
      categoryCountMap[catName] = (categoryCountMap[catName] || 0) + 1;
    });

    const categoriesList = Object.entries(categoryCountMap).map(([name, count]) => ({
      name,
      count,
    }));

    return {
      resolved,
      inProgress,
      openCount,
      totalConfirmations,
      categoriesList,
    };
  }, [selectedClusterReports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (activeTab === 'open') {
      return selectedClusterReports.filter((r) => r.status?.toLowerCase() !== 'resolved');
    }
    if (activeTab === 'resolved') {
      return selectedClusterReports.filter((r) => r.status?.toLowerCase() === 'resolved');
    }
    return selectedClusterReports;
  }, [selectedClusterReports, activeTab]);

  const totalFilteredCount = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));
  const paginatedReports = filteredReports.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleBack = () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleShare = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `[Bedrock Civic Hotspot] Sector ${clusterTitle}: ${totalCount} infrastructure reports logged at Coordinates ${selectedClusterMeta?.lat.toFixed(4)}, ${selectedClusterMeta?.lng.toFixed(4)}.`,
      });
    } catch {}
  };

  const toggleFollow = () => {
    if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsFollowing((prev) => !prev);
  };

  /* ── List Header ─────────────────────────────────────────────────── */
  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      {/* Cluster summary */}
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LinearGradient
          colors={[accentColor + '20', accentColor + '06', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={styles.heroTopRow}>
          <View style={[styles.categoryBadge, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
            <IconSymbol name={categoryIcon as any} size={12} color={accentColor} />
            <Text style={[styles.categoryBadgeText, { color: accentColor }]}>
              {clusterTitle} hotspot
            </Text>
          </View>

          {selectedClusterMeta && (
            <View style={[styles.coordBadge, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <IconSymbol name="mappin.and.ellipse" color={colors.textDim} size={10} />
              <Text style={[styles.coordText, { color: colors.textDim }]}>
                {selectedClusterMeta.lat.toFixed(4)}, {selectedClusterMeta.lng.toFixed(4)}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.heroTitle, { color: colors.text }]}>
          {totalCount} {totalCount === 1 ? 'report' : 'reports'} in this area
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.textDim }]}>
          Related community reports grouped by location.
        </Text>

        {/* Cluster summary metrics */}
        <View style={[styles.metricsStrip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.error }]}>{metrics.openCount}</Text>
            <Text style={[styles.metricLabel, { color: colors.textDim }]}>Open</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.warning }]}>{metrics.inProgress}</Text>
            <Text style={[styles.metricLabel, { color: colors.textDim }]}>In progress</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.success }]}>{metrics.resolved}</Text>
            <Text style={[styles.metricLabel, { color: colors.textDim }]}>Resolved</Text>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.text }]}>{metrics.totalConfirmations}</Text>
            <Text style={[styles.metricLabel, { color: colors.textDim }]}>Confirmations</Text>
          </View>
        </View>

        {/* Category breakdown chips */}
        {metrics.categoriesList.length > 0 && (
          <View style={styles.categoryBreakdown}>
            <Text style={[styles.breakdownTitle, { color: colors.textDim }]}>Issue types</Text>
            <View style={styles.categoryChipsRow}>
              {metrics.categoriesList.map((cat, idx) => (
                <View key={idx} style={[styles.catChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.catChipText, { color: colors.text }]}>
                    {cat.name} <Text style={{ color: accentColor, fontWeight: '700' }}>{cat.count}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.followButton,
            {
              backgroundColor: isFollowing ? colors.surface2 : accentColor,
              borderColor: isFollowing ? colors.border : accentColor,
            },
          ]}
          onPress={toggleFollow}
          activeOpacity={0.8}
        >
          <IconSymbol
            name={isFollowing ? 'checkmark.circle.fill' : 'bell.badge.fill'}
            color={isFollowing ? colors.text : '#FFFFFF'}
            size={14}
          />
          <Text
            style={[
              styles.followButtonText,
              { color: isFollowing ? colors.text : '#FFFFFF' },
            ]}
          >
            {isFollowing ? 'Following hotspot' : 'Follow hotspot'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Filter Row */}
      <View style={[styles.tabBarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'all' && [styles.tabBtnActive, { backgroundColor: colors.surface2 }]]}
          onPress={() => {
            if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('all');
            setCurrentPage(1);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: activeTab === 'all' ? colors.text : colors.textDim }]}>
            All <Text style={[styles.tabCount, { color: activeTab === 'all' ? colors.accent : colors.textDim }]}>{totalCount}</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'open' && [styles.tabBtnActive, { backgroundColor: colors.surface2 }]]}
          onPress={() => {
            if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('open');
            setCurrentPage(1);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: activeTab === 'open' ? colors.text : colors.textDim }]}>
            Open <Text style={[styles.tabCount, { color: activeTab === 'open' ? colors.accent : colors.textDim }]}>{metrics.openCount + metrics.inProgress}</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'resolved' && [styles.tabBtnActive, { backgroundColor: colors.surface2 }]]}
          onPress={() => {
            if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('resolved');
            setCurrentPage(1);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: activeTab === 'resolved' ? colors.text : colors.textDim }]}>
            Resolved <Text style={[styles.tabCount, { color: activeTab === 'resolved' ? colors.accent : colors.textDim }]}>{metrics.resolved}</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridSectionHeading}>
        <Text style={[styles.gridHeadingText, { color: colors.text }]}>Reports</Text>
        <Text style={[styles.gridCountText, { color: colors.textDim }]}>{totalFilteredCount}</Text>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </View>
  );

  /* ── Main Render ─────────────────────────────────────────────────── */
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top Action Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.actionBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" color={colors.text} size={18} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.topBarSubtitle, { color: colors.textDim }]}>REPORT CLUSTER</Text>
          <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
            {clusterTitle} Cluster
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleShare}
          style={[styles.actionBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <IconSymbol name="square.and.arrow.up" color={colors.text} size={16} />
        </TouchableOpacity>
      </View>

      {/* Reports 2-Column Grid */}
      <FlatList
        key="cluster-2-col-grid"
        data={paginatedReports}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReportCard report={item} userLocation={userLocation} variant="grid" />
        )}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 12, paddingHorizontal: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyCenter}>
            <IconSymbol name="map.fill" color={colors.surface2} size={48} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Reports in View</Text>
            <Text style={[styles.emptyBody, { color: colors.textDim }]}>
              There are no reports matching the selected &quot;{activeTab.toUpperCase()}&quot; filter in this hotspot.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  topBarSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerWrapper: {
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  coordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  coordText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  metricDivider: {
    width: 1,
    height: 26,
  },
  categoryBreakdown: {
    marginBottom: 12,
  },
  breakdownTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabBarContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  tabBtnActive: {
    // dynamically styled
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  gridSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  gridHeadingText: {
    fontSize: 16,
    fontWeight: '700',
  },
  gridCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerContainer: {
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  emptyCenter: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

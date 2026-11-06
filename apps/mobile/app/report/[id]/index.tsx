import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  useColorScheme,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useRecentlyViewedStore } from '@/stores/useRecentlyViewedStore';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const LIFECYCLE_STAGES = [
  { key: 'reported',    label: 'Reported',    icon: 'flag.fill' },
  { key: 'verified',    label: 'Verified',    icon: 'checkmark.seal.fill' },
  { key: 'assigned',    label: 'Assigned',    icon: 'person.crop.circle.badge.checkmark' },
  { key: 'in_progress', label: 'In progress', icon: 'hammer.fill' },
  { key: 'resolved',    label: 'Resolved',    icon: 'checkmark.circle.fill' },
];

function getStageIndex(status: string): number {
  const s = status?.toLowerCase() || '';
  if (s === 'resolved')    return 4;
  if (s === 'in_progress') return 3;
  if (s === 'assigned')    return 2;
  if (s === 'verified')    return 1;
  return 0;
}

function getDepartment(categoryName?: string): { dept: string; est: string } {
  const cat = categoryName?.toLowerCase() || '';
  if (cat.includes('road') || cat.includes('pothole') || cat.includes('traffic'))
    return { dept: 'Roads & Civil Infrastructure', est: '2–5 days' };
  if (cat.includes('water') || cat.includes('drain') || cat.includes('pipe'))
    return { dept: 'Water & Sanitation Authority', est: '1–3 days' };
  if (cat.includes('power') || cat.includes('light') || cat.includes('electric'))
    return { dept: 'Energy & Electrical Services', est: '4–8 hrs' };
  if (cat.includes('waste') || cat.includes('trash') || cat.includes('garbage'))
    return { dept: 'Environmental Health', est: '24 hrs' };
  return { dept: 'Municipal Public Works', est: '3–7 days' };
}

function getPriority(confirmations: number): { label: string; color: string; desc: string } {
  if (confirmations >= 10) return { label: 'Critical',  color: '#ef4444', desc: 'Immediate municipal response required' };
  if (confirmations >= 5)  return { label: 'High',      color: '#f59e0b', desc: 'Escalated to senior operations team' };
  if (confirmations >= 2)  return { label: 'Moderate',  color: '#60a5fa', desc: 'Scheduled for next available crew' };
  return                          { label: 'Standard',  color: '#71717a', desc: 'Logged and queued for review' };
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'reported':    return '#71717a';
    case 'verified':    return '#60a5fa';
    case 'assigned':
    case 'in_progress': return '#f59e0b';
    case 'resolved':    return '#4ade80';
    default:            return '#52525b';
  }
}

function getStatusLabel(status: string): string {
  if (!status) return 'New';
  if (status.toLowerCase() === 'in_progress') return 'In progress';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={[sectionHeaderStyle.label, { color: colors.textDim }]}>{label}</Text>
  );
}
const sectionHeaderStyle = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 10, marginTop: 4 },
});

// ─── Carousel report card (for nearby / recently viewed) ──────────────────────
function ReportCarouselCard({ report, onPress, colors }: {
  report: any;
  onPress: () => void;
  colors: any;
}) {
  const sc = getStatusColor(report.status);
  const photo = report.photoUrl || (report.report_photos?.[0]
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-photos/${report.report_photos[0].image_url}`
    : null);

  return (
    <TouchableOpacity
      style={[carouselCardStyle.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={carouselCardStyle.imgContainer}>
        {photo ? (
          <Image source={{ uri: photo }} style={carouselCardStyle.img} />
        ) : (
          <View style={[carouselCardStyle.imgPlaceholder, { backgroundColor: colors.surface2 }]}>
            <IconSymbol
              name={report.categoryIcon || report.categories?.icon || 'flag.fill'}
              color={report.categoryColor || report.categories?.color || colors.accent}
              size={22}
            />
          </View>
        )}
        <View style={carouselCardStyle.badgeOverlay}>
          <View style={[carouselCardStyle.statusPill, { backgroundColor: sc }]}>
            <Text style={carouselCardStyle.statusText}>{getStatusLabel(report.status)}</Text>
          </View>
        </View>
      </View>

      <View style={carouselCardStyle.body}>
        <Text style={[carouselCardStyle.category, { color: report.categoryColor || report.categories?.color || colors.accent }]} numberOfLines={1}>
          {report.categoryName || report.categories?.name || 'Report'}
        </Text>
        <Text style={[carouselCardStyle.desc, { color: colors.text }]} numberOfLines={2}>
          {report.description || 'No description.'}
        </Text>
        {report.address ? (
          <View style={carouselCardStyle.addrRow}>
            <IconSymbol name="mappin" color={colors.textDim} size={11} />
            <Text style={[carouselCardStyle.addr, { color: colors.textDim }]} numberOfLines={1}>
              {report.address}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const carouselCardStyle = StyleSheet.create({
  card: {
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imgContainer: {
    width: '100%',
    height: 104,
    position: 'relative',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  body: {
    padding: 10,
  },
  category: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  desc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 6,
    minHeight: 32,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addr: {
    fontSize: 10,
    flex: 1,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { hapticsEnabled, theme: storeTheme } = useSettingsStore();
  const queryClient = useQueryClient();
  const userId = useAuthStore(state => state.session?.user?.id);
  const scrollViewRef = useRef<ScrollView>(null);
  const { recent, addRecent } = useRecentlyViewedStore();
  const [intelExpanded, setIntelExpanded] = useState(false);

  const currentTheme = storeTheme === 'auto' ? (systemColorScheme || 'light') : storeTheme;
  const colors = theme[currentTheme as 'light' | 'dark'];
  const isDark = currentTheme === 'dark';

  // ── Fetch main report ──
  const { data: report, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      if (!id) throw new Error('No report ID');
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          categories (*),
          report_photos (image_url),
          profiles:user_id (full_name),
          status_history (*, changed_by_profile:profiles!status_history_changed_by_fkey (full_name)),
          comments (*, comment_profile:profiles!comments_user_id_fkey (full_name))
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Record recently viewed ──
  useEffect(() => {
    if (!report) return;
    addRecent({
      id: report.id,
      description: report.description,
      address: report.address,
      status: report.status,
      categoryName: report.categories?.name,
      categoryIcon: report.categories?.icon,
      categoryColor: report.categories?.color,
      photoUrl: report.report_photos?.[0]
        ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-photos/${report.report_photos[0].image_url}`
        : undefined,
      viewedAt: Date.now(),
    });
  }, [report?.id]);

  // ── Nearby reports (same category, within ~1km grid) ──
  const { data: nearbyReports } = useQuery({
    queryKey: ['nearby-reports', report?.id, report?.latitude, report?.longitude, report?.category_id],
    queryFn: async () => {
      if (!report) return [];
      const lat = Number(report.latitude);
      const lng = Number(report.longitude);
      const delta = 0.015; // ~1.5km
      const { data, error } = await supabase
        .from('reports')
        .select(`id, description, address, status, latitude, longitude, categories (name, icon, color), report_photos (image_url)`)
        .neq('id', report.id)
        .gte('latitude', lat - delta)
        .lte('latitude', lat + delta)
        .gte('longitude', lng - delta)
        .lte('longitude', lng + delta)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) return [];
      return data;
    },
    enabled: !!report,
  });

  // ── Follow state ──
  const { data: isFollowing } = useQuery({
    queryKey: ['report-follow', id, userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error: queryError } = await supabase
        .from('report_follows')
        .select('*')
        .eq('report_id', id)
        .eq('user_id', userId)
        .single();
      if (queryError?.code === 'PGRST205' || queryError?.code === 'PGRST116') return false;
      return !!data;
    },
    enabled: !!userId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      if (isFollowing) {
        await supabase.from('report_follows').delete().eq('report_id', id).eq('user_id', userId);
      } else {
        await supabase.from('report_follows').insert({ report_id: id, user_id: userId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-follow', id, userId] });
      if (hapticsEnabled) Haptics.notificationAsync(
        isFollowing ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
      );
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be logged in');
      const { error } = await supabase
        .from('report_follows')
        .upsert({ report_id: id as string, user_id: userId }, { onConflict: 'report_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-follow', id, userId] });
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Confirmed', 'You\'ve confirmed this issue. We\'ll notify you when it\'s resolved.');
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Unable to confirm.');
    },
  });

  const handleShare = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `${report?.categories?.name || 'Issue'}: ${report?.description}\nLocation: ${report?.address}`,
      });
    } catch {}
  };

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textDim }]}>Loading report…</Text>
      </View>
    );
  }

  if (isError || !report) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <IconSymbol name="exclamationmark.triangle.fill" color={colors.error} size={36} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Couldn't load report</Text>
        <Text style={[styles.errorSub, { color: colors.textDim }]}>{(queryError as any)?.message || 'Not found'}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          onPress={() => queryClient.invalidateQueries({ queryKey: ['report', id] })}
        >
          <Text style={[styles.retryText, { color: colors.text }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = !!(userId && report.user_id === userId);
  const currentStage = getStageIndex(report.status);
  const statusColor = getStatusColor(report.status);
  const { dept, est } = getDepartment(report.categories?.name);
  const priority = getPriority(report.confirmation_count || 0);
  const photoUrl = report.report_photos?.[0]
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-photos/${report.report_photos[0].image_url}`
    : null;

  const recentOthers = recent.filter(r => r.id !== id).slice(0, 4);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ── Floating header ── */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: isDark ? 'rgba(12,11,9,0.92)' : 'rgba(253,249,243,0.92)',
          borderBottomColor: colors.border,
        }
      ]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <IconSymbol name="chevron.left" color={colors.text} size={18} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {report.categories?.name || 'Report'}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textDim }]}>
            {timeAgo(report.created_at)}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <IconSymbol name="square.and.arrow.up" color={colors.textDim} size={17} />
          </TouchableOpacity>
          {!isOwner && (
            <TouchableOpacity
              onPress={() => followMutation.mutate()}
              style={[styles.headerBtn, { backgroundColor: isFollowing ? colors.accentSoft : colors.surface, borderColor: isFollowing ? colors.accent : colors.border }]}
            >
              <IconSymbol
                name={isFollowing ? 'heart.fill' : 'heart'}
                color={isFollowing ? colors.accent : colors.textDim}
                size={17}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 120 }}
      >
        {/* ── Hero photo ── */}
        {photoUrl ? (
          <View style={styles.heroWrap}>
            <Image source={{ uri: photoUrl }} style={styles.heroImg} />
            <View style={styles.heroOverlay}>
              <View style={[styles.categoryChip, { backgroundColor: report.categories?.color || colors.accent }]}>
                <IconSymbol name={report.categories?.icon || 'flag.fill'} color="#fff" size={12} />
                <Text style={styles.categoryChipText}>{report.categories?.name || 'Report'}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: statusColor }]}>
                <Text style={styles.statusChipText}>{getStatusLabel(report.status)}</Text>
              </View>
            </View>
          </View>
        ) : (
          /* No photo — coloured banner */
          <View style={[styles.bannerNoPhoto, { backgroundColor: (report.categories?.color || colors.accent) + '18' }]}>
            <View style={[styles.bannerIconCircle, { backgroundColor: (report.categories?.color || colors.accent) + '25' }]}>
              <IconSymbol name={report.categories?.icon || 'flag.fill'} color={report.categories?.color || colors.accent} size={28} />
            </View>
            <View>
              <Text style={[styles.bannerCategory, { color: report.categories?.color || colors.accent }]}>
                {report.categories?.name || 'Report'}
              </Text>
              <View style={[styles.statusChip, { backgroundColor: statusColor }]}>
                <Text style={styles.statusChipText}>{getStatusLabel(report.status)}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.body}>
          {/* ── Description ── */}
          <Text style={[styles.description, { color: colors.text }]}>
            {report.description || 'No description provided.'}
          </Text>

          {/* ── Reporter row ── */}
          <View style={[styles.reporterRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.avatarText, { color: colors.accent }]}>
                {(report.profiles?.full_name || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.reporterName, { color: colors.text }]}>
                {isOwner ? 'You' : (report.profiles?.full_name || 'Anonymous citizen')}
              </Text>
              <Text style={[styles.reporterSub, { color: colors.textDim }]}>
                Reported {timeAgo(report.created_at)} · Lusaka
              </Text>
            </View>
            {isOwner && (
              <View style={[styles.ownerPill, { backgroundColor: colors.accentSoft, borderColor: colors.accent + '40' }]}>
                <Text style={[styles.ownerPillText, { color: colors.accent }]}>Your report</Text>
              </View>
            )}
          </View>

          {/* ── Resolution progress (tap to open full field log) ── */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (hapticsEnabled) Haptics.selectionAsync();
              router.push(`/report/${id}/log` as any);
            }}
          >
            <View style={styles.sectionHeaderRow}>
              <SectionHeader label="Resolution progress" colors={colors} />
              <View style={styles.fieldLogBadge}>
                <Text style={[styles.fieldLogBadgeText, { color: colors.accent }]}>
                  Field log & history
                </Text>
                <IconSymbol name="chevron.right" color={colors.accent} size={11} />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.stageRow}>
                {LIFECYCLE_STAGES.map((st, idx) => {
                  const passed  = idx < currentStage;
                  const current = idx === currentStage;
                  return (
                    <React.Fragment key={st.key}>
                      <View style={styles.stageItem}>
                        <View style={[
                          styles.stageDot,
                          passed  && { backgroundColor: colors.success, borderColor: colors.success },
                          current && { backgroundColor: colors.accent,  borderColor: colors.accent },
                          !passed && !current && { backgroundColor: colors.surface2, borderColor: colors.border },
                        ]}>
                          {passed  && <IconSymbol name="checkmark" color="#fff" size={9} />}
                          {current && <View style={[styles.stageDotInner, { backgroundColor: colors.background }]} />}
                        </View>
                        <Text style={[
                          styles.stageLabel,
                          { color: current ? colors.accent : passed ? colors.text : colors.textDim },
                          current && { fontWeight: '700' },
                        ]} numberOfLines={1}>
                          {st.label}
                        </Text>
                      </View>
                      {idx < LIFECYCLE_STAGES.length - 1 && (
                        <View style={[styles.stageConnector, { backgroundColor: passed ? colors.success : colors.border }]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>

              <View style={[styles.progressActionRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.stageNote, { color: colors.textDim }]}>
                  Stage {currentStage + 1} of {LIFECYCLE_STAGES.length} · Est: {est}
                </Text>
                <View style={styles.progressActionRight}>
                  <Text style={[styles.progressActionLink, { color: colors.accent }]}>
                    Full dispatch trail ({report.status_history?.length || 0})
                  </Text>
                  <IconSymbol name="chevron.right" color={colors.accent} size={11} />
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Intelligence panel (collapsible) ── */}
          <TouchableOpacity
            onPress={() => {
              if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setIntelExpanded(prev => !prev);
            }}
            style={[styles.collapseHeader, { borderColor: colors.border }]}
            activeOpacity={0.75}
          >
            <View style={styles.collapseHeaderLeft}>
              <Text style={[styles.collapseLabel, { color: colors.textDim }]}>Issue intelligence</Text>
              {!intelExpanded && (
                <View style={[styles.priorityPillSmall, { backgroundColor: priority.color + '20' }]}>
                  <Text style={[styles.priorityPillSmallText, { color: priority.color }]}>
                    {priority.label} priority
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.collapseRight}>
              <Text style={[styles.collapseCount, { color: colors.textDim }]}>
                {intelExpanded ? 'Hide' : 'Details'}
              </Text>
              <IconSymbol
                name={intelExpanded ? 'chevron.up' : 'chevron.down'}
                color={colors.textDim}
                size={12}
              />
            </View>
          </TouchableOpacity>

          {intelExpanded && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 4 }]}>
              {/* Priority */}
              <View style={[styles.intelRow, { borderBottomColor: colors.border }]}>
                <View style={styles.intelLeft}>
                  <View style={[styles.intelIcon, { backgroundColor: priority.color + '20' }]}>
                    <IconSymbol name="exclamationmark.triangle.fill" color={priority.color} size={14} />
                  </View>
                  <View>
                    <Text style={[styles.intelKey, { color: colors.textDim }]}>Priority</Text>
                    <Text style={[styles.intelVal, { color: priority.color }]}>{priority.label}</Text>
                  </View>
                </View>
                <Text style={[styles.intelNote, { color: colors.textDim }]} numberOfLines={2}>
                  {priority.desc}
                </Text>
              </View>
              {/* Department */}
              <View style={[styles.intelRow, { borderBottomColor: colors.border }]}>
                <View style={styles.intelLeft}>
                  <View style={[styles.intelIcon, { backgroundColor: colors.accentSoft }]}>
                    <IconSymbol name="building.2.fill" color={colors.accent} size={14} />
                  </View>
                  <View>
                    <Text style={[styles.intelKey, { color: colors.textDim }]}>Responsible dept.</Text>
                    <Text style={[styles.intelVal, { color: colors.text }]} numberOfLines={1}>{dept}</Text>
                  </View>
                </View>
              </View>
              {/* Confirmations */}
              <View style={[styles.intelRow, { borderBottomColor: colors.border }]}>
                <View style={styles.intelLeft}>
                  <View style={[styles.intelIcon, { backgroundColor: colors.info + '20' }]}>
                    <IconSymbol name="person.2.fill" color={colors.info} size={14} />
                  </View>
                  <View>
                    <Text style={[styles.intelKey, { color: colors.textDim }]}>Community confirmations</Text>
                    <Text style={[styles.intelVal, { color: colors.text }]}>
                      {report.confirmation_count || 1} {report.confirmation_count === 1 ? 'person' : 'people'}
                    </Text>
                  </View>
                </View>
              </View>
              {/* Response target */}
              <View style={[styles.intelRowLast]}>
                <View style={styles.intelLeft}>
                  <View style={[styles.intelIcon, { backgroundColor: colors.success + '20' }]}>
                    <IconSymbol name="clock.fill" color={colors.success} size={14} />
                  </View>
                  <View>
                    <Text style={[styles.intelKey, { color: colors.textDim }]}>Estimated response</Text>
                    <Text style={[styles.intelVal, { color: colors.text }]}>
                      {report.status === 'resolved' ? 'Completed' : est}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── Location & Mini map ── */}
          <SectionHeader label="Location" colors={colors} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, overflow: 'hidden', padding: 0 }]}>
            <MapView
              style={styles.miniMap}
              initialRegion={{
                latitude: Number(report.latitude),
                longitude: Number(report.longitude),
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              userInterfaceStyle={currentTheme as 'light' | 'dark'}
            >
              <Circle
                center={{ latitude: Number(report.latitude), longitude: Number(report.longitude) }}
                radius={60}
                fillColor={(report.categories?.color || colors.accent) + '30'}
                strokeColor={(report.categories?.color || colors.accent) + '80'}
                strokeWidth={1.5}
              />
              <Marker
                coordinate={{ latitude: Number(report.latitude), longitude: Number(report.longitude) }}
                pinColor={report.categories?.color || colors.accent}
              />
            </MapView>
            <View style={[styles.mapMeta, { borderTopColor: colors.border }]}>
              <IconSymbol name="mappin.and.ellipse" color={colors.accent} size={14} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.mapAddress, { color: colors.text }]}>{report.address}</Text>
                <Text style={[styles.mapCoords, { color: colors.textDim }]}>
                  {Math.abs(Number(report.latitude)).toFixed(4)}° S, {Math.abs(Number(report.longitude)).toFixed(4)}° E
                </Text>
              </View>
            </View>
          </View>



          {/* ── Nearby problems (Carousel) ── */}
          {nearbyReports && nearbyReports.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <SectionHeader label={`${nearbyReports.length} other problem${nearbyReports.length > 1 ? 's' : ''} in this area`} colors={colors} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carouselScroll}
                contentContainerStyle={styles.carouselTrack}
              >
                {nearbyReports.map((r: any) => (
                  <ReportCarouselCard
                    key={r.id}
                    report={r}
                    colors={colors}
                    onPress={() => router.push(`/report/${r.id}` as any)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Recently viewed (Carousel) ── */}
          {recentOthers.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <SectionHeader label="Recently viewed" colors={colors} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carouselScroll}
                contentContainerStyle={styles.carouselTrack}
              >
                {recentOthers.map((r) => (
                  <ReportCarouselCard
                    key={r.id}
                    report={r}
                    colors={colors}
                    onPress={() => router.push(`/report/${r.id}` as any)}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Footer CTA ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {isOwner ? (
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.accent }]}
            onPress={() => {
              if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/report/${id}/log` as any);
            }}
            activeOpacity={0.85}
          >
            <IconSymbol name="waveform.path.ecg" color={colors.background} size={16} />
            <Text style={[styles.ctaText, { color: colors.background }]}>Track progress & field log</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.cta,
              isFollowing
                ? { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }
                : { backgroundColor: colors.accent },
            ]}
            onPress={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
            activeOpacity={0.85}
          >
            {confirmMutation.isPending ? (
              <ActivityIndicator color={isFollowing ? colors.textDim : colors.background} size="small" />
            ) : (
              <>
                <IconSymbol
                  name={isFollowing ? 'checkmark.circle.fill' : 'plus.circle.fill'}
                  color={isFollowing ? colors.success : colors.background}
                  size={16}
                />
                <Text style={[styles.ctaText, { color: isFollowing ? colors.text : colors.background }]}>
                  {isFollowing ? 'Confirmed — you\'ll be notified' : 'Confirm this issue'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: { marginTop: 12, fontSize: 13 },
  errorTitle: { fontSize: 17, fontWeight: '600', marginTop: 14 },
  errorSub: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  retryText: { fontSize: 14, fontWeight: '600' },

  /* Header */
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerBtn: {
    width: 34, height: 34,
    borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },

  /* Hero */
  heroWrap: { width: '100%', height: 240, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statusChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  statusChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  bannerNoPhoto: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bannerIconCircle: {
    width: 56, height: 56,
    borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  bannerCategory: { fontSize: 16, fontWeight: '700', marginBottom: 6 },

  /* Body */
  body: { paddingHorizontal: 16, paddingTop: 18 },
  description: { fontSize: 17, fontWeight: '600', lineHeight: 26, marginBottom: 16 },

  /* Reporter */
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  avatar: {
    width: 36, height: 36,
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  reporterName: { fontSize: 13, fontWeight: '600' },
  reporterSub: { fontSize: 11, marginTop: 1 },
  ownerPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 7, borderWidth: 1,
  },
  ownerPillText: { fontSize: 11, fontWeight: '600' },

  /* Progress */
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stageItem: { alignItems: 'center', flex: 1 },
  stageDot: {
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 5,
  },
  stageDotInner: { width: 5, height: 5, borderRadius: 2.5 },
  stageConnector: { flex: 1, height: 2, marginTop: 9, marginHorizontal: -2 },
  stageLabel: { fontSize: 9, fontWeight: '500', textAlign: 'center' },
  stageNote: { fontSize: 11, textAlign: 'center', marginTop: 4 },

  /* Intel */
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  intelRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    gap: 10,
  },
  intelLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  intelIcon: {
    width: 32, height: 32,
    borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  intelKey: { fontSize: 11, marginBottom: 1 },
  intelVal: { fontSize: 13, fontWeight: '600' },
  intelNote: { fontSize: 11, textAlign: 'right', maxWidth: 120, lineHeight: 15 },

  /* Mini map */
  miniMap: { height: 160 },
  mapMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mapAddress: { fontSize: 13, fontWeight: '500' },
  mapCoords: { fontSize: 10, marginTop: 2 },

  /* Progress section header & link */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 4,
  },
  fieldLogBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  fieldLogBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  progressActionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressActionLink: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Collapsible Issue Intelligence */
  collapseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  collapseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapseLabel: { fontSize: 12, fontWeight: '600' },
  priorityPillSmall: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityPillSmallText: {
    fontSize: 10,
    fontWeight: '700',
  },
  collapseRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collapseCount: { fontSize: 11 },

  /* Timeline */
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineLine: {
    position: 'absolute',
    left: 4,
    top: 14,
    bottom: -16,
    width: 2,
  },
  timelineDot: {
    width: 10, height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 12,
    zIndex: 1,
  },
  timelineCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  timelineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineStatus: { fontSize: 13, fontWeight: '600' },
  timelineTime: { fontSize: 11 },
  timelineNote: { fontSize: 12, lineHeight: 17 },
  timelineOfficer: { fontSize: 11, marginTop: 6 },
  emptyLog: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  emptyLogText: { flex: 1, fontSize: 12, lineHeight: 18 },

  /* Carousel */
  carouselScroll: {
    marginHorizontal: -16,
  },
  carouselTrack: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  ctaText: { fontSize: 15, fontWeight: '700' },
});

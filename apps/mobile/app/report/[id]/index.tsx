import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Linking,
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
import { StatusBar } from 'expo-status-bar';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useRecentlyViewedStore } from '@/stores/useRecentlyViewedStore';
import { getPrivateImageUrl } from '@/lib/storage';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  { key: 'reported', label: 'Reported' },
  { key: 'verified', label: 'Verified' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
];

const reportContextLabels: Record<string, string> = {
  issue_ongoing: 'Issue still happening',
  road_blocked: 'Road or footpath blocked',
  water_collecting: 'Water collecting at damage',
  leak_active: 'Leak still active',
  access_affected: 'Nearby access or property affected',
  waste_blocking_access: 'Waste blocking access',
  hazardous_waste: 'Possible hazardous waste',
  exposed_wires: 'Exposed wires',
  sparks_or_fire: 'Sparks or fire',
};

const answerLabels: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  unsure: 'Unsure',
};

function getStageIndex(status: string): number {
  const s = status?.toLowerCase() || '';
  if (s === 'resolved')    return 4;
  if (s === 'in_progress') return 3;
  if (s === 'assigned')    return 2;
  if (s === 'verified')    return 1;
  return 0;
}

function getDepartment(categoryName?: string): string {
  const cat = categoryName?.toLowerCase() || '';
  if (cat.includes('road') || cat.includes('pothole') || cat.includes('traffic'))
    return 'Roads & Civil Infrastructure';
  if (cat.includes('water') || cat.includes('drain') || cat.includes('pipe'))
    return 'Water & Sanitation Authority';
  if (cat.includes('power') || cat.includes('light') || cat.includes('electric'))
    return 'Energy & Electrical Services';
  if (cat.includes('waste') || cat.includes('trash') || cat.includes('garbage'))
    return 'Environmental Health';
  return 'Municipal Public Works';
}

function getPriority(confirmations: number, colors: typeof theme.light): { label: string; color: string; desc: string } {
  if (confirmations >= 10) return { label: 'Critical',  color: colors.error, desc: 'Immediate municipal response required' };
  if (confirmations >= 5)  return { label: 'High',      color: colors.warning, desc: 'Escalated to senior operations team' };
  if (confirmations >= 2)  return { label: 'Moderate',  color: colors.info, desc: 'Scheduled for next available crew' };
  return                          { label: 'Standard',  color: colors.textDim, desc: 'Logged and queued for review' };
}

function getStatusColor(status: string, colors: typeof theme.light): string {
  switch (status?.toLowerCase()) {
    case 'reported':    return colors.textDim;
    case 'verified':    return colors.info;
    case 'assigned':
    case 'in_progress': return colors.warning;
    case 'resolved':    return colors.success;
    default:            return colors.textMuted;
  }
}

function getStatusLabel(status: string): string {
  if (!status) return 'New';
  if (status.toLowerCase() === 'in_progress') return 'In progress';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, colors }: { label: string; colors: typeof theme.light }) {
  return (
    <Text style={[sectionHeaderStyle.label, { color: colors.text }]}>{label}</Text>
  );
}
const sectionHeaderStyle = StyleSheet.create({
  label: { fontSize: 16, fontWeight: '700', marginBottom: 9, marginTop: 12 },
});

// ─── Carousel report card (for nearby / recently viewed) ──────────────────────
function ReportCarouselCard({ report, onPress, colors }: {
  report: any;
  onPress: () => void;
  colors: any;
}) {
  const photo = report.report_photos?.[0];
  const imagePath = report.photoUrl || photo?.image_url;
  const bucket = photo?.bucket_id || 'report-photos';
  const [signedPhoto, setSignedPhoto] = useState<{ key: string; url: string } | null>(null);
  const photoKey = imagePath ? `${bucket}:${imagePath}` : null;
  const photoUrl = photoKey && signedPhoto?.key === photoKey ? signedPhoto.url : null;
  const sc = getStatusColor(report.status, colors);

  useEffect(() => {
    let active = true;

    if (!imagePath) return () => { active = false; };

    getPrivateImageUrl(imagePath, bucket)
      .then(url => {
        if (active) setSignedPhoto({ key: `${bucket}:${imagePath}`, url });
      })
      .catch(error => console.error('Unable to load report photo:', error));

    return () => { active = false; };
  }, [imagePath, bucket]);

  return (
    <TouchableOpacity
      style={[carouselCardStyle.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={carouselCardStyle.imgContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={carouselCardStyle.img} />
        ) : (
          <View style={[carouselCardStyle.imgPlaceholder, { backgroundColor: colors.surface2 }]}>
            <IconSymbol
              name={report.categoryIcon || report.categories?.icon || 'flag.fill'}
              color={colors.accent}
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
        <Text style={[carouselCardStyle.category, { color: colors.accent }]} numberOfLines={1}>
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
  const scrollViewRef = useRef<any>(null);
  const { recent, addRecent } = useRecentlyViewedStore();
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [photoPosition, setPhotoPosition] = useState<{ reportId: string | undefined; index: number }>({
    reportId: undefined,
    index: 0,
  });
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [reportPhotoUrls, setReportPhotoUrls] = useState<string[]>([]);

  const currentTheme = storeTheme === 'auto' ? (systemColorScheme || 'light') : storeTheme;
  const colors = theme[currentTheme as 'light' | 'dark'];
  const isDark = currentTheme === 'dark';

  // ── Fetch main report ──
  const { data: report, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['report', id, userId],
    queryFn: async () => {
      if (!id) throw new Error('No report ID');
      if (userId) {
        const { data: ownedReport, error: ownerError } = await supabase
          .from('my_reports')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (ownerError) throw ownerError;
        if (ownedReport) {
          const { data: incidentContext, error: contextError } = await supabase
            .from('my_report_context')
            .select('occurred_at, immediate_danger, category_details')
            .eq('id', id)
            .maybeSingle();
          if (contextError) throw contextError;
          return { ...ownedReport, incident_context: incidentContext };
        }
      }

      const { data, error } = await supabase
        .from('public_reports')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Report not found or not publicly available');
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    let active = true;
    const photos = [...(report?.report_photos || [])]
      .sort((first, second) => {
        const primaryDifference = Number(Boolean(second.is_primary)) - Number(Boolean(first.is_primary));
        if (primaryDifference !== 0) return primaryDifference;
        return (first.uploaded_at || '').localeCompare(second.uploaded_at || '');
      });

    Promise.all(photos.map(photo => getPrivateImageUrl(
      photo.image_url,
      photo.bucket_id || 'report-photos'
    ).catch(error => {
      console.error('Unable to load report photo:', error);
      return '';
    }))).then(urls => {
      if (active) setReportPhotoUrls(urls.filter(Boolean));
    });

    return () => { active = false; };
  }, [report?.report_photos]);
  const activePhotoIndex = photoPosition.reportId === report?.id ? photoPosition.index : 0;

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
      photoUrl: reportPhotoUrls[0],
      viewedAt: Date.now(),
    });
  }, [report, reportPhotoUrls, addRecent]);

  // ── Nearby reports (same category, within ~1km grid) ──
  const { data: nearbyReports } = useQuery({
    queryKey: ['nearby-reports', report?.id, report?.latitude, report?.longitude, report?.category_id],
    queryFn: async () => {
      if (!report) return [];
      const lat = Number(report.latitude);
      const lng = Number(report.longitude);
      const delta = 0.015; // ~1.5km
      const { data, error } = await supabase
        .from('public_reports')
        .select('*')
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
        <Text style={[styles.errorTitle, { color: colors.text }]}>Couldn&apos;t load report</Text>
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

  const isOwner = !!report.is_owner;
  const currentStage = getStageIndex(report.status);
  const statusColor = getStatusColor(report.status, colors);
  const dept = getDepartment(report.categories?.name);
  const priority = getPriority(report.confirmation_count || 0, colors);
  const photoUrl = reportPhotoUrls[0] || null;
  const latitude = Number(report.latitude);
  const longitude = Number(report.longitude);

  const openReportLocation = async () => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert('Location unavailable', 'This report does not have valid map coordinates.');
      return;
    }

    const placeName = encodeURIComponent(report.address || 'Report location');
    const mapUrl = Platform.select({
      ios: `http://maps.apple.com/?ll=${latitude},${longitude}&q=${placeName}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${placeName})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });

    try {
      await Linking.openURL(mapUrl || `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
    } catch {
      Alert.alert('Unable to open map', 'Please try opening the location again.');
    }
  };

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
        {isOwner && !report.is_public && (
          <View style={[styles.reviewNotice, { backgroundColor: colors.warning + '18', borderColor: colors.warning + '55' }]}>
            <IconSymbol name="lock.fill" color={colors.warning} size={16} />
            <Text style={[styles.reviewNoticeText, { color: colors.text }]}>
              This report is private while the department reviews it. It will not appear in public browsing until approved.
            </Text>
          </View>
        )}

        {/* ── Hero photo ── */}
        {photoUrl ? (
          <View style={styles.heroWrap}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={event => {
                setPhotoPosition({
                  reportId: report.id,
                  index: Math.round(event.nativeEvent.contentOffset.x / SCREEN_W),
                });
              }}
            >
              {reportPhotoUrls.map((uri, index) => (
                <TouchableOpacity
                  key={`${uri}-${index}`}
                  activeOpacity={0.95}
                  accessibilityRole="button"
                  accessibilityLabel={`View photo ${index + 1} full screen`}
                  onPress={() => {
                    setPhotoPosition({ reportId: report.id, index });
                    setPhotoViewerVisible(true);
                  }}
                >
                  <Image source={{ uri }} style={[styles.heroImg, { width: SCREEN_W }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {reportPhotoUrls.length > 1 && (
              <View style={styles.photoCount}>
                <Text style={styles.photoCountText}>{activePhotoIndex + 1} / {reportPhotoUrls.length}</Text>
              </View>
            )}
            <View style={styles.heroOverlay}>
              <View style={[styles.categoryChip, { backgroundColor: colors.accent }]}>
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
          <View style={[styles.bannerNoPhoto, { backgroundColor: colors.accentSoft }]}>
            <View style={[styles.bannerIconCircle, { backgroundColor: colors.surface }]}>
              <IconSymbol name={report.categories?.icon || 'flag.fill'} color={colors.accent} size={28} />
            </View>
            <View>
              <Text style={[styles.bannerCategory, { color: colors.accent }]}>
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
          <SectionHeader label="Description" colors={colors} />
          <View style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.description, { color: colors.text }]}>
              {report.description || 'No description provided.'}
            </Text>
          </View>

          {isOwner && report.incident_context && (
            <>
              <SectionHeader label="Incident details" colors={colors} />
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.contextLabel, { color: colors.textDim }]}>When it happened</Text>
                <Text style={[styles.contextValue, { color: colors.text }]}>
                  {report.incident_context.occurred_at
                    ? new Date(report.incident_context.occurred_at).toLocaleString()
                    : 'Not sure'}
                </Text>

                <Text style={[styles.contextLabel, { color: colors.textDim }]}>Immediate danger</Text>
                <Text style={[styles.contextValue, { color: colors.text }]}>
                  {answerLabels[report.incident_context.immediate_danger] || 'Unsure'}
                </Text>

                {Object.entries(report.incident_context.category_details || {}).map(([key, value]) => (
                  <View key={key}>
                    <Text style={[styles.contextLabel, { color: colors.textDim }]}>
                      {reportContextLabels[key] || key.replace(/_/g, ' ')}
                    </Text>
                    <Text style={[styles.contextValue, { color: colors.text }]}>
                      {answerLabels[String(value)] || 'Unsure'}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

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
              <View style={styles.progressSummary}>
                <View style={styles.progressStatus}>
                  <View style={[styles.progressStatusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.progressStatusLabel, { color: colors.text }]}>
                    {getStatusLabel(report.status)}
                  </Text>
                </View>
                <Text style={[styles.progressStepCount, { color: colors.textDim }]}>
                  Stage {currentStage + 1} of {LIFECYCLE_STAGES.length}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                {LIFECYCLE_STAGES.map((stage, index) => (
                  <View
                    key={stage.key}
                    style={[
                      styles.progressSegment,
                      {
                        backgroundColor: index < currentStage
                          ? colors.success
                          : index === currentStage
                            ? colors.accent
                            : colors.surface2,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.progressEndpoints}>
                <Text style={[styles.progressEndpointLabel, { color: colors.textDim }]}>
                  {LIFECYCLE_STAGES[0].label}
                </Text>
                <Text style={[styles.progressEndpointLabel, { color: colors.textDim }]}>
                  {LIFECYCLE_STAGES[LIFECYCLE_STAGES.length - 1].label}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Location & Mini map ── */}
          <SectionHeader label="Location" colors={colors} />
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, overflow: 'hidden', padding: 0 }]}
            onPress={openReportLocation}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`Open map at ${report.address || 'report location'}`}
          >
            <MapView
              style={styles.miniMap}
              initialRegion={{
                latitude,
                longitude,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }}
              pointerEvents="none"
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              userInterfaceStyle={currentTheme as 'light' | 'dark'}
            >
              <Circle
                center={{ latitude, longitude }}
                radius={isOwner ? 60 : 750}
                fillColor={colors.accent + '30'}
                strokeColor={colors.accent + '80'}
                strokeWidth={1.5}
              />
              <Marker
                coordinate={{ latitude, longitude }}
                pinColor={colors.accent}
              />
            </MapView>
            <View style={[styles.mapMeta, { borderTopColor: colors.border }]}>
              <IconSymbol name="mappin.and.ellipse" color={colors.accent} size={14} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.mapAddress, { color: colors.text }]} numberOfLines={2}>
                  {report.address || 'View report location'}
                </Text>
                <Text style={[styles.mapCoords, { color: colors.textDim }]}>
                  {Math.abs(latitude).toFixed(isOwner ? 5 : 2)}° S, {Math.abs(longitude).toFixed(isOwner ? 5 : 2)}° E
                </Text>
                {!isOwner && (
                  <Text style={[styles.mapCoords, { color: colors.textDim }]}>Approximate public location</Text>
                )}
              </View>
              <View style={styles.mapAction}>
                <Text style={[styles.mapActionText, { color: colors.accent }]}>Open map</Text>
                <IconSymbol name="chevron.right" color={colors.accent} size={13} />
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Report details ── */}
          <SectionHeader label="Reported by" colors={colors} />
          <View style={[styles.reporterRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.avatarText, { color: colors.accent }]}>
                {isOwner ? 'Y' : 'C'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.reporterName, { color: colors.text }]}>
                {isOwner ? 'You' : 'Community member'}
              </Text>
              <Text style={[styles.reporterSub, { color: colors.textDim }]}>
                {timeAgo(report.created_at)}
              </Text>
            </View>
            {isOwner && (
              <View style={[styles.ownerPill, { backgroundColor: colors.accentSoft, borderColor: colors.accent + '40' }]}>
                <Text style={[styles.ownerPillText, { color: colors.accent }]}>Your report</Text>
              </View>
            )}
          </View>

          {/* ── Issue intelligence ── */}
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
              <Text style={[styles.collapseLabel, { color: colors.text }]}>Issue intelligence</Text>
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
            </View>
          )}

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

      {photoViewerVisible && (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setPhotoViewerVisible(false)}
        >
          <View style={styles.photoViewer}>
            <StatusBar style="light" />
            <ScrollView
              horizontal
              pagingEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: SCREEN_W * activePhotoIndex, y: 0 }}
              onMomentumScrollEnd={event => {
                setPhotoPosition({
                  reportId: report.id,
                  index: Math.round(event.nativeEvent.contentOffset.x / SCREEN_W),
                });
              }}
            >
              {reportPhotoUrls.map((uri, index) => (
                <Image
                  key={`${uri}-${index}`}
                  source={{ uri }}
                  style={{ width: SCREEN_W, height: SCREEN_H }}
                  resizeMode="contain"
                  accessibilityLabel={`Report photo ${index + 1} of ${reportPhotoUrls.length}`}
                />
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.photoViewerClose, { top: insets.top + 10 }]}
              onPress={() => setPhotoViewerVisible(false)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Close full-screen photo"
            >
              <IconSymbol name="xmark.circle.fill" color="#fff" size={30} />
            </TouchableOpacity>
            {reportPhotoUrls.length > 1 && (
              <View style={[styles.photoViewerCount, { bottom: Math.max(insets.bottom, 14) + 10 }]}>
                <Text style={styles.photoCountText}>
                  {activePhotoIndex + 1} / {reportPhotoUrls.length}
                </Text>
              </View>
            )}
          </View>
        </Modal>
      )}

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
  photoCount: {
    position: 'absolute',
    top: 12,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  photoCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
  reviewNotice: {
    margin: 14,
    marginBottom: 0,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  reviewNoticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  descriptionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  description: { fontSize: 15, fontWeight: '400', lineHeight: 23 },
  contextLabel: { fontSize: 11, fontWeight: '600', marginTop: 12 },
  contextValue: { fontSize: 14, lineHeight: 20, marginTop: 3 },

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
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressStatusDot: { width: 9, height: 9, borderRadius: 5 },
  progressStatusLabel: { fontSize: 15, fontWeight: '700' },
  progressStepCount: { fontSize: 12, fontWeight: '500' },
  progressTrack: { flexDirection: 'row', gap: 5, marginTop: 14 },
  progressSegment: { height: 7, borderRadius: 4, flex: 1 },
  progressEndpoints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressEndpointLabel: { fontSize: 10, fontWeight: '500' },

  /* Intel */
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  mapAction: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8 },
  mapActionText: { fontSize: 11, fontWeight: '600' },

  /* Full-screen photo viewer */
  photoViewer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  photoViewerClose: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
    padding: 6,
  },
  photoViewerCount: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

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

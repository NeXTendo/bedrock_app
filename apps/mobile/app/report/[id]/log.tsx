import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSettingsStore } from '@/stores/useSettingsStore';
import * as Haptics from 'expo-haptics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDuration(startStr: string, endStr?: string): string {
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const diffHours = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60)));
  if (diffHours < 1) return '< 1 hour';
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  const days = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;
  if (remHours === 0) return `${days} day${days === 1 ? '' : 's'}`;
  return `${days}d ${remHours}h`;
}

const LIFECYCLE_STAGES = [
  { key: 'reported', label: 'Reported' },
  { key: 'verified', label: 'Verified' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
];

function getStageIndex(status: string): number {
  const s = status?.toLowerCase() || '';
  if (s === 'resolved')    return 4;
  if (s === 'in_progress') return 3;
  if (s === 'assigned')    return 2;
  if (s === 'verified')    return 1;
  return 0;
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FieldLogScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { hapticsEnabled, theme: storeTheme } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' ? (systemColorScheme || 'light') : storeTheme;
  const colors = theme[currentTheme as 'light' | 'dark'];
  const isDark = currentTheme === 'dark';

  const { data: report, isLoading, isError, refetch } = useQuery({
    queryKey: ['report-detail-log', id],
    queryFn: async () => {
      if (!id) throw new Error('No report ID');
      const { data: ownedReport, error: ownerError } = await supabase
        .from('my_reports')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (ownerError) throw ownerError;
      if (ownedReport) return ownedReport;

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

  const handleShare = async () => {
    if (hapticsEnabled) Haptics.selectionAsync();
    try {
      await Share.share({
        message: `Field log for report #${String(id).slice(0, 8)} (${report?.categories?.name || 'Problem'}): Status is ${report?.status || 'Active'}.`,
      });
    } catch {
      // Ignored
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centerScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textDim }]}>Loading field audit trail...</Text>
      </View>
    );
  }

  if (isError || !report) {
    return (
      <View style={[styles.centerScreen, { backgroundColor: colors.background }]}>
        <IconSymbol name="exclamationmark.triangle.fill" color={colors.accent} size={40} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Unable to load field log</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.accent }]}
          onPress={() => refetch()}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStage = getStageIndex(report.status);
  const statusColor = getStatusColor(report.status, colors);
  const { dept, est } = getDepartment(report.categories?.name);
  const rawHistory: any[] = report.status_history || [];

  // Sort descending by date for the detailed feed
  const sortedHistory = rawHistory
    .slice()
    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

  const displayedHistory = sortedHistory;

  const resolvedAt = report.status?.toLowerCase() === 'resolved'
    ? report.resolved_at || sortedHistory[0]?.changed_at
    : undefined;
  const totalDuration = getDuration(report.created_at, resolvedAt);

  const assignedCrewName = null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ── Floating Header ── */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: isDark ? 'rgba(12,11,9,0.94)' : 'rgba(253,249,243,0.94)',
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
            Report activity
          </Text>
          <Text style={[styles.headerSub, { color: colors.textDim }]}>
            {report.categories?.name || 'Report'} · #{String(report.id).slice(0, 8)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleShare}
          style={[styles.headerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <IconSymbol name="square.and.arrow.up" color={colors.textDim} size={16} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 68,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
      >
        {/* ── Report summary ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 4 }]}>
          <View style={styles.bannerTopRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
              <View style={[styles.statusBadgeDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {getStatusLabel(report.status)}
              </Text>
            </View>
            <Text style={[styles.durationBadge, { color: colors.textDim }]}>
              {report.status?.toLowerCase() === 'resolved' ? `Resolved in ${totalDuration}` : `Open for ${totalDuration}`}
            </Text>
          </View>

          <Text style={[styles.bannerTitle, { color: colors.text }]} numberOfLines={3}>
            {report.description || 'Report in progress'}
          </Text>

          <View style={styles.summaryMetaRow}>
            <View style={styles.summaryMetaItem}>
              <IconSymbol name="building.2.fill" color={colors.textDim} size={13} />
              <Text style={[styles.summaryMetaText, { color: colors.textDim }]} numberOfLines={1}>{dept}</Text>
            </View>
            <View style={styles.summaryMetaItem}>
              <IconSymbol name="clock.fill" color={colors.textDim} size={13} />
              <Text style={[styles.summaryMetaText, { color: colors.textDim }]} numberOfLines={1}>{est}</Text>
            </View>
          </View>

          {assignedCrewName && (
            <View style={[styles.crewRow, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <IconSymbol name="person.badge.shield.checkmark.fill" color={colors.accent} size={15} />
              <Text style={[styles.crewText, { color: colors.text }]}>
                Assigned crew: <Text style={{ fontWeight: '700' }}>{assignedCrewName}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* ── Progress ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>Resolution progress</Text>
            <Text style={[styles.progressCount, { color: colors.textDim }]}>{currentStage + 1} of {LIFECYCLE_STAGES.length}</Text>
          </View>
          <View style={styles.progressTrack}>
            {LIFECYCLE_STAGES.map((stage, index) => (
              <View
                key={stage.key}
                style={[
                  styles.progressSegment,
                  { backgroundColor: index <= currentStage ? colors.accent : colors.surface2 },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.progressStatus, { color: colors.accent }]}>{getStatusLabel(report.status)}</Text>
        </View>

        {/* ── Activity timeline ── */}
        <View style={styles.filterSection}>
          <View style={styles.filterLeft}>
            <Text style={[styles.activityTitle, { color: colors.text }]}>
              Activity
            </Text>
            <Text style={[styles.activityCount, { color: colors.textDim }]}>
              {displayedHistory.length} {displayedHistory.length === 1 ? 'update' : 'updates'}
            </Text>
          </View>
        </View>

        {/* ── Timeline entries ── */}
        {displayedHistory.length > 0 ? (
          <View style={styles.timelineContainer}>
            {displayedHistory.map((h: any, idx: number, arr: any[]) => {
              const sc = getStatusColor(h.new_status, colors);
              const isFirst = idx === 0;
              const hasNote = !!h.note;

              return (
                <View key={h.id || idx} style={styles.timelineRow}>
                  {/* Vertical line connecting nodes */}
                  {idx < arr.length - 1 && (
                    <View style={[styles.timelineTrack, { backgroundColor: colors.border }]} />
                  )}

                  {/* Timeline marker */}
                  <View style={[
                    styles.timelineNode,
                    {
                      backgroundColor: colors.background,
                      borderColor: sc,
                    }
                  ]}>
                    <View style={[styles.timelineNodeCore, { backgroundColor: sc }]} />
                  </View>

                  <View style={[
                    styles.timelineCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    isFirst && { borderColor: sc + '50' },
                  ]}>
                    <View style={styles.timelineCardHeader}>
                      <View style={[styles.cardStatusChip, { backgroundColor: sc + '18' }]}>
                        <Text style={[styles.cardStatusText, { color: sc }]}>
                          {getStatusLabel(h.new_status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.timelineTimestamp, { color: colors.textDim }]}>
                      {formatFullDate(h.changed_at)}
                    </Text>

                    {hasNote && (
                      <View style={[styles.noteBox, { borderLeftColor: colors.accent }]}>
                        <Text style={[styles.noteText, { color: colors.text }]}>{h.note}</Text>
                      </View>
                    )}

                    <View style={styles.cardFooter}>
                      <IconSymbol name="person.crop.circle" color={colors.textDim} size={12} />
                      <Text style={[styles.officerName, { color: colors.textDim }]}>
                        {h.changed_by_profile?.full_name || 'Municipal Dispatch'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentSoft }]}>
              <IconSymbol name="clock.arrow.circlepath" color={colors.accent} size={24} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No activity updates yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textDim }]}>
              Public status changes will appear here as work progresses.
            </Text>
          </View>
        )}

        {/* ── Initial report ── */}
        <View style={[styles.baseSubmissionCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <View style={styles.baseSubmissionHeader}>
            <IconSymbol name="flag.fill" color={colors.accent} size={13} />
            <Text style={[styles.baseSubmissionTitle, { color: colors.text }]}>
              Report submitted
            </Text>
          </View>
          <Text style={[styles.baseSubmissionDetails, { color: colors.textDim }]}>
            {formatFullDate(report.created_at)} · {report.address || 'Lusaka'}
          </Text>
        </View>

        {/* ── Audit note ── */}
        <View style={styles.auditFootnote}>
          <IconSymbol name="lock.shield" color={colors.textDim} size={13} />
          <Text style={[styles.auditFootnoteText, { color: colors.textDim }]}>
            Status changes and dispatch notes are recorded in this report history.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centerScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 12,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },

  /* Header */
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },

  /* Card */
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },

  /* Summary */
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  durationBadge: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'right',
  },
  bannerTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 14,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  summaryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  summaryMetaText: {
    fontSize: 11,
  },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  crewText: {
    fontSize: 12,
  },

  /* Progress */
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 5,
  },
  progressSegment: {
    height: 5,
    borderRadius: 3,
    flex: 1,
  },
  progressStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },

  /* Activity filter */
  filterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 6,
  },
  filterLeft: {
    flex: 1,
    marginRight: 10,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  activityCount: {
    fontSize: 11,
    marginTop: 2,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(127,127,127,0.08)',
    borderRadius: 10,
    padding: 3,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 0,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Timeline */
  timelineContainer: {
    paddingLeft: 2,
    marginBottom: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 10,
  },
  timelineTrack: {
    position: 'absolute',
    left: 7,
    top: 17,
    bottom: -10,
    width: 1,
  },
  timelineNode: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginRight: 10,
    zIndex: 2,
  },
  timelineNodeCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineCard: {
    flex: 1,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  cardStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  cardStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineTimestamp: {
    fontSize: 11,
    marginBottom: 7,
  },
  noteBox: {
    borderLeftWidth: 3,
    paddingLeft: 9,
    paddingVertical: 2,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  officerName: {
    fontSize: 10,
  },

  /* Empty state */
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },

  /* Base submission */
  baseSubmissionCard: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 13,
    marginBottom: 10,
  },
  baseSubmissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  baseSubmissionTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  baseSubmissionDetails: {
    fontSize: 11,
    lineHeight: 16,
  },

  /* Footnote */
  auditFootnote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  auditFootnoteText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});

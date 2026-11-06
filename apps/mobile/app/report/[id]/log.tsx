import React, { useState } from 'react';
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

  const [activeFilter, setActiveFilter] = useState<'all' | 'notes'>('all');

  const { data: report, isLoading, isError, refetch } = useQuery({
    queryKey: ['report-detail-log', id],
    queryFn: async () => {
      if (!id) throw new Error('No report ID');
      // Primary query with status history & assignments
      try {
        const { data, error } = await supabase
          .from('reports')
          .select(`
            *,
            categories (*),
            profiles:user_id (full_name),
            status_history (*, changed_by_profile:profiles!status_history_changed_by_fkey (full_name)),
            assignments (*, assigned_to_profile:profiles!assignments_assigned_to_fkey (full_name))
          `)
          .eq('id', id)
          .single();
        if (error) throw error;
        return data;
      } catch {
        // Fallback without assignments
        const { data, error } = await supabase
          .from('reports')
          .select(`
            *,
            categories (*),
            profiles:user_id (full_name),
            status_history (*, changed_by_profile:profiles!status_history_changed_by_fkey (full_name))
          `)
          .eq('id', id)
          .single();
        if (error) throw error;
        return data;
      }
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
  const statusColor = getStatusColor(report.status);
  const { dept, est } = getDepartment(report.categories?.name);
  const rawHistory: any[] = report.status_history || [];

  // Sort descending by date for the detailed feed
  const sortedHistory = rawHistory
    .slice()
    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

  // Filter if notes requested
  const displayedHistory = activeFilter === 'notes'
    ? sortedHistory.filter(h => !!h.note)
    : sortedHistory;

  const totalDuration = getDuration(report.created_at, report.status === 'resolved' ? sortedHistory[0]?.changed_at : undefined);

  // Find assigned crew details
  const assignment = Array.isArray(report.assignments) ? report.assignments[0] : report.assignments;
  const assignedCrewName = assignment?.assigned_to_profile?.full_name || assignment?.crew_name || null;

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
            Field log & audit trail
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
        {/* ── Status Banner Card ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 4 }]}>
          <View style={styles.bannerTopRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
              <View style={[styles.statusBadgeDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {getStatusLabel(report.status)}
              </Text>
            </View>
            <Text style={[styles.durationBadge, { color: colors.textDim }]}>
              Active {totalDuration}
            </Text>
          </View>

          <Text style={[styles.bannerTitle, { color: colors.text }]}>
            {report.description || 'Report in progress'}
          </Text>

          <View style={[styles.bannerDivider, { backgroundColor: colors.border }]} />

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.textDim }]}>Responsible dept</Text>
              <Text style={[styles.metaVal, { color: colors.text }]} numberOfLines={1}>{dept}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.textDim }]}>Target turnaround</Text>
              <Text style={[styles.metaVal, { color: colors.text }]}>{est}</Text>
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

        {/* ── Lifecycle Stepper ── */}
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Resolution progression</Text>
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
          <Text style={[styles.stageSubtitle, { color: colors.textDim }]}>
            Current milestone: <Text style={{ color: colors.text, fontWeight: '600' }}>{getStatusLabel(report.status)}</Text>
            {report.status === 'resolved' ? ' · Issue successfully closed' : ` · Next review scheduled`}
          </Text>
        </View>

        {/* ── Filter Bar ── */}
        <View style={styles.filterSection}>
          <View style={styles.filterLeft}>
            <Text style={[styles.sectionTitle, { color: colors.textDim, marginBottom: 0 }]}>
              Activity timeline ({rawHistory.length})
            </Text>
          </View>
          <View style={styles.filterTabs}>
            <TouchableOpacity
              onPress={() => {
                if (hapticsEnabled) Haptics.selectionAsync();
                setActiveFilter('all');
              }}
              style={[
                styles.filterTab,
                { backgroundColor: activeFilter === 'all' ? colors.accentSoft : 'transparent', borderColor: activeFilter === 'all' ? colors.accent : colors.border }
              ]}
            >
              <Text style={[styles.filterTabText, { color: activeFilter === 'all' ? colors.accent : colors.textDim }]}>
                All updates
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (hapticsEnabled) Haptics.selectionAsync();
                setActiveFilter('notes');
              }}
              style={[
                styles.filterTab,
                { backgroundColor: activeFilter === 'notes' ? colors.accentSoft : 'transparent', borderColor: activeFilter === 'notes' ? colors.accent : colors.border }
              ]}
            >
              <Text style={[styles.filterTabText, { color: activeFilter === 'notes' ? colors.accent : colors.textDim }]}>
                With notes
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Timeline Entries ── */}
        {displayedHistory.length > 0 ? (
          <View style={styles.timelineContainer}>
            {displayedHistory.map((h: any, idx: number, arr: any[]) => {
              const sc = getStatusColor(h.new_status);
              const isFirst = idx === 0;
              const hasNote = !!h.note;

              return (
                <View key={h.id || idx} style={styles.timelineRow}>
                  {/* Vertical line connecting nodes */}
                  {idx < arr.length - 1 && (
                    <View style={[styles.timelineTrack, { backgroundColor: colors.border }]} />
                  )}

                  {/* Node icon / dot */}
                  <View style={[
                    styles.timelineNode,
                    {
                      backgroundColor: isFirst ? sc : colors.surface,
                      borderColor: sc,
                    }
                  ]}>
                    <View style={[
                      styles.timelineNodeCore,
                      { backgroundColor: isFirst ? '#ffffff' : sc }
                    ]} />
                  </View>

                  {/* Content card */}
                  <View style={[
                    styles.timelineCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    isFirst && { borderColor: sc + '60' },
                  ]}>
                    <View style={styles.timelineCardHeader}>
                      <View style={[styles.cardStatusChip, { backgroundColor: sc + '18' }]}>
                        <Text style={[styles.cardStatusText, { color: sc }]}>
                          {getStatusLabel(h.new_status)}
                        </Text>
                      </View>
                      <Text style={[styles.timelineTimeAgo, { color: colors.textDim }]}>
                        {timeAgo(h.changed_at)}
                      </Text>
                    </View>

                    <Text style={[styles.timelineTimestamp, { color: colors.textDim }]}>
                      {formatFullDate(h.changed_at)}
                    </Text>

                    {hasNote ? (
                      <View style={[styles.noteBox, { backgroundColor: colors.surface2, borderLeftColor: colors.accent }]}>
                        <IconSymbol name="quote.opening" color={colors.accent} size={12} style={{ marginBottom: 4 }} />
                        <Text style={[styles.noteText, { color: colors.text }]}>
                          {h.note}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.defaultNote, { color: colors.textDim }]}>
                        Status transitioned to {getStatusLabel(h.new_status)}.
                      </Text>
                    )}

                    <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                      <View style={styles.officerRow}>
                        <IconSymbol name="person.crop.circle" color={colors.textDim} size={13} />
                        <Text style={[styles.officerName, { color: colors.textDim }]}>
                          {h.changed_by_profile?.full_name ? `Recorded by ${h.changed_by_profile.full_name}` : 'Recorded by Municipal Dispatch'}
                        </Text>
                      </View>
                      <View style={[styles.verifiedTag, { backgroundColor: colors.surface2 }]}>
                        <IconSymbol name="checkmark.shield.fill" color={colors.success} size={10} />
                        <Text style={[styles.verifiedTagText, { color: colors.textDim }]}>Verified</Text>
                      </View>
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
              {activeFilter === 'notes' ? 'No dispatch notes recorded' : 'Initial report logged'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textDim }]}>
              {activeFilter === 'notes'
                ? 'No qualitative field remarks have been attached to this report yet.'
                : 'This problem is in the dispatch queue. Field operations will post milestone updates as crews are assigned.'}
            </Text>
          </View>
        )}

        {/* ── Initial Submission Log (Base record) ── */}
        <View style={[styles.baseSubmissionCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <View style={styles.baseSubmissionHeader}>
            <IconSymbol name="flag.fill" color={colors.accent} size={13} />
            <Text style={[styles.baseSubmissionTitle, { color: colors.text }]}>
              Initial citizen report filed
            </Text>
            <Text style={[styles.baseSubmissionTime, { color: colors.textDim }]}>
              {timeAgo(report.created_at)}
            </Text>
          </View>
          <Text style={[styles.baseSubmissionDetails, { color: colors.textDim }]}>
            Filed on {formatFullDate(report.created_at)} · Location: {report.address || 'Lusaka'}
          </Text>
        </View>

        {/* ── Municipal Audit Footnote ── */}
        <View style={styles.auditFootnote}>
          <IconSymbol name="lock.shield" color={colors.textDim} size={13} />
          <Text style={[styles.auditFootnoteText, { color: colors.textDim }]}>
            Public audit trail verified by Bedrock Municipal Infrastructure Services. All entries are immutable.
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
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },

  /* Status Banner */
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
  },
  bannerTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  bannerDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  crewText: {
    fontSize: 12,
  },

  /* Stepper */
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 4,
  },
  stageItem: {
    alignItems: 'center',
    flex: 1,
  },
  stageDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stageDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  stageConnector: {
    height: 2,
    flex: 1,
    marginBottom: 18,
    marginHorizontal: -4,
  },
  stageSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    paddingTop: 2,
  },

  /* Filter */
  filterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  filterLeft: {
    flex: 1,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Timeline */
  timelineContainer: {
    paddingLeft: 4,
    marginBottom: 12,
  },
  timelineRow: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 16,
  },
  timelineTrack: {
    position: 'absolute',
    left: 8,
    top: 20,
    bottom: -16,
    width: 2,
  },
  timelineNode: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginRight: 12,
    zIndex: 2,
  },
  timelineNodeCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardStatusChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timelineTimeAgo: {
    fontSize: 11,
  },
  timelineTimestamp: {
    fontSize: 10,
    marginBottom: 8,
  },
  noteBox: {
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: 9,
    marginBottom: 10,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  defaultNote: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  officerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  officerName: {
    fontSize: 10,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: '600',
  },

  /* Empty state */
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
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
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  baseSubmissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  baseSubmissionTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  baseSubmissionTime: {
    fontSize: 11,
  },
  baseSubmissionDetails: {
    fontSize: 10,
  },

  /* Footnote */
  auditFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  auditFootnoteText: {
    fontSize: 10,
    lineHeight: 15,
    flex: 1,
  },
});

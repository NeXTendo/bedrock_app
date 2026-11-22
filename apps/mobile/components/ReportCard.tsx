import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Share, useColorScheme, Platform } from 'react-native';
import { getCategoryColor, theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface ReportCardProps {
  report: {
    id: string;
    description: string;
    address: string;
    status: string;
    created_at: string;
    latitude: number;
    longitude: number;
    categories?: {
      name: string;
      icon: string;
      color: string;
    };
    report_photos?: {
      image_url: string;
    }[];
  };
  userLocation?: {
    coords: {
      latitude: number;
      longitude: number;
    };
  } | null;
  variant?: 'standard' | 'grid';
}

export function ReportCard({ report, userLocation, variant = 'standard' }: ReportCardProps) {
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();

  const currentTheme = storeTheme === 'auto'
    ? (systemColorScheme || 'light')
    : storeTheme;

  const colors = theme[currentTheme as 'light' | 'dark'];
  const categoryColor = getCategoryColor(report.categories?.icon, colors);

  const calculateDistance = () => {
    if (!userLocation || !report.latitude || !report.longitude) return null;
    const R = 6371;
    const dLat = (report.latitude - userLocation.coords.latitude) * Math.PI / 180;
    const dLon = (report.longitude - userLocation.coords.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(userLocation.coords.latitude * Math.PI / 180) * Math.cos(report.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
  };

  const handleShare = async () => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `[Bedrock] ${report.categories?.name || 'Report'}: ${report.description}\nLocation: ${report.address}`,
      });
    } catch {}
  };

  const distance = calculateDistance();

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    switch (s) {
      case 'new':
      case 'reported':    return colors.textDim;
      case 'verified':    return colors.info;
      case 'assigned':
      case 'in_progress': return colors.warning;
      case 'resolved':    return colors.success;
      default:            return colors.textDim;
    }
  };

  const getStatusLabel = (status: string) => {
    const s = status?.toLowerCase() || '';
    switch (s) {
      case 'in_progress': return 'In progress';
      case 'new':         return 'New';
      default:            return status?.charAt(0).toUpperCase() + status?.slice(1).toLowerCase() || 'New';
    }
  };

  const statusColor = getStatusColor(report.status);
  const statusBackground = `${statusColor}1A`;
  const photoUrl = report.report_photos?.[0]
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-photos/${report.report_photos[0].image_url}`
    : null;

  // ── Grid variant ─────────────────────────────────────────────────────────
  if (variant === 'grid') {
    return (
      <TouchableOpacity 
        style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/report/${report.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.gridImageWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.gridImage} />
          ) : (
            <View style={[styles.gridImagePlaceholder, { backgroundColor: colors.surface2 }]}>
              <IconSymbol name="camera.fill" color={colors.textDim} size={20} />
            </View>
          )}
          <View style={[styles.statusPill, { backgroundColor: statusBackground }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{getStatusLabel(report.status)}</Text>
          </View>
        </View>

        <View style={styles.gridBody}>
          <View style={styles.categoryRow}>
            <IconSymbol 
              name={(report.categories?.icon || 'paperplane') as any} 
              color={categoryColor}
              size={10} 
            />
            <Text 
              style={[styles.categoryLabel, { color: colors.text }]}
              numberOfLines={1}
            >
              {report.categories?.name || 'Report'}
            </Text>
            {distance && (
              <Text style={[styles.distanceLabel, { color: colors.textDim }]}>· {distance}</Text>
            )}
          </View>

          <Text style={[styles.gridDesc, { color: colors.text }]} numberOfLines={2}>
            {report.description || 'No description.'}
          </Text>

          <View style={[styles.gridFooter, { borderTopColor: colors.border }]}>
            <IconSymbol name="mappin.and.ellipse" color={colors.textDim} size={10} />
            <Text style={[styles.gridAddress, { color: colors.textDim }]} numberOfLines={1}>
              {report.address || 'Unknown location'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Standard variant ──────────────────────────────────────────────────────
  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/report/${report.id}`)}
      activeOpacity={0.88}
    >
      <View style={styles.imageWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.image} />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.surface2 }]}>
            <IconSymbol name="camera.fill" color={colors.textDim} size={28} />
          </View>
        )}
        <View style={[styles.statusPill, { backgroundColor: statusBackground }]}>
          <Text style={[styles.statusPillText, { color: statusColor }]}>{getStatusLabel(report.status)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.categoryRow}>
          <IconSymbol 
            name={(report.categories?.icon || 'paperplane') as any} 
            color={categoryColor}
            size={12} 
          />
          <Text style={[styles.categoryLabel, { color: colors.text }]}>
            {report.categories?.name || 'Uncategorized'}
          </Text>
          {distance && (
            <>
              <View style={[styles.dot, { backgroundColor: colors.textDim }]} />
              <Text style={[styles.distanceLabel, { color: colors.textDim }]}>{distance} away</Text>
            </>
          )}
        </View>

        <Text style={[styles.description, { color: colors.text }]} numberOfLines={2}>
          {report.description || 'No description.'}
        </Text>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.footerLeft}>
            <IconSymbol name="mappin.and.ellipse" color={colors.textDim} size={11} />
            <Text style={[styles.address, { color: colors.textDim }]} numberOfLines={1}>
              {report.address}
            </Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={[styles.date, { color: colors.textDim }]}>
              {new Date(report.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
            <TouchableOpacity 
              onPress={handleShare} 
              style={[styles.shareBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <IconSymbol name="square.and.arrow.up" color={colors.accent} size={13} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  /* Standard card */
  card: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#292E28',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  imageWrap: { height: 180, width: '100%' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  statusPill: {
    position: 'absolute',
    top: 10, right: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  body: { padding: 16 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, opacity: 0.5, marginHorizontal: 2 },
  distanceLabel: { fontSize: 11 },
  description: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 10,
  },
  address: { fontSize: 12 },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  date: { fontSize: 12 },
  shareBtn: {
    width: 32, height: 32,
    borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },

  /* Grid card */
  gridCard: {
    flex: 1,
    margin: 4,
    borderRadius: 18,
    borderWidth: 0,
    overflow: 'hidden',
  },
  gridImageWrap: { height: 100, width: '100%' },
  gridImage: { width: '100%', height: '100%' },
  gridImagePlaceholder: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  gridBody: { padding: 10 },
  gridDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginBottom: 8,
    minHeight: 32,
  },
  gridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  gridAddress: {
    fontSize: 10,
    flex: 1,
  },
});

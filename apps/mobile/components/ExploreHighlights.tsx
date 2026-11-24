import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ImageBackground, useColorScheme } from 'react-native';
import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { getPrivateImageUrl } from '@/lib/storage';

interface HighlightReport {
  id: string;
  description: string;
  address: string;
  status: string;
  categories: {
    name: string;
    icon: string;
    color: string;
  };
  report_photos: {
    image_url: string;
    bucket_id?: string;
  }[];
}

interface ExploreHighlightsProps {
  reports: HighlightReport[];
}

export function ExploreHighlights({ reports }: ExploreHighlightsProps) {
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    Promise.all(reports.map(async report => {
      const photo = report.report_photos[0];
      if (!photo) return [report.id, ''] as const;

      try {
        return [
          report.id,
          await getPrivateImageUrl(photo.image_url, photo.bucket_id || 'report-photos'),
        ] as const;
      } catch (error) {
        console.error('Unable to load highlight photo:', error);
        return [report.id, ''] as const;
      }
    })).then(entries => {
      if (active) setPhotoUrls(Object.fromEntries(entries.filter(([, url]) => url)));
    });

    return () => { active = false; };
  }, [reports]);

  if (!reports || reports.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>CRITICAL FIELD DISPATCHES</Text>
        <View style={[styles.liveIndicator, { backgroundColor: colors.error + '18', borderColor: colors.error + '35' }]}>
          <IconSymbol name="exclamationmark.triangle.fill" color={colors.error} size={12} />
          <Text style={[styles.liveText, { color: colors.error }]}>PRIORITY</Text>
        </View>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        snapToInterval={296}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        {reports.map((report) => (
          <TouchableOpacity 
            key={report.id} 
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/report/${report.id}`)}
            activeOpacity={0.88}
          >
            <ImageBackground
              source={photoUrls[report.id] ? { uri: photoUrls[report.id] } : undefined}
              style={styles.image}
              imageStyle={{ borderRadius: 4 }}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.92)']}
                style={styles.gradient}
              >
                <View style={styles.cardContent}>
                  <View style={[styles.badge, { backgroundColor: report.categories?.color || colors.accent }]}>
                    <IconSymbol name={(report.categories?.icon || 'paperplane') as any} color="#fff" size={10} />
                    <Text style={styles.badgeText}>{report.categories?.name}</Text>
                  </View>
                  <Text style={styles.description} numberOfLines={2}>
                    {report.description}
                  </Text>
                  <View style={styles.locationRow}>
                    <IconSymbol name="mappin.and.ellipse" color="rgba(255,255,255,0.7)" size={12} />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {report.address}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 2,
    borderWidth: 1,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  scrollContent: {
    paddingRight: 20,
  },
  card: {
    width: 280,
    height: 165,
    marginRight: 12,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    borderRadius: 4,
    justifyContent: 'flex-end',
    padding: 12,
  },
  cardContent: {
    gap: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    gap: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    flex: 1,
  },
});

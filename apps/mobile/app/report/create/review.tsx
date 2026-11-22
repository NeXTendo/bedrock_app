import { StyleSheet, View, Text, TouchableOpacity, Image, TextInput, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useReportStore } from '@/stores/reportStore';
import { useAppColors } from '@/hooks/useAppColors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { uploadImageAsync } from '@/lib/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReviewStepScreen() {
  const router = useRouter();
  const { draft, resetDraft } = useReportStore();
  const colors = useAppColors();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!draft.location || !draft.category || !user) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Upload photo(s) to Supabase Storage if present
      const photoUrls: string[] = [];

      if (draft.photos && draft.photos.length > 0) {
        for (let i = 0; i < draft.photos.length; i++) {
          const photoUri = draft.photos[i];
          const fileName = `${user.id}/${Date.now()}_${i}.jpg`;
          const uploadRes = await uploadImageAsync(photoUri, fileName, {
            bucket: 'report-photos',
            maxWidth: 1200,
            quality: 0.7,
          });
          photoUrls.push(uploadRes.path);
        }
      }

      // 2. Create report via RPC
      const { error: reportError } = await supabase.rpc('create_report', {
        p_category_id: draft.category,
        p_description: description,
        p_severity: draft.severity,
        p_lat: draft.location.latitude,
        p_lng: draft.location.longitude,
        p_address: draft.location.address,
        p_photo_urls: photoUrls,
        p_anonymous: isAnonymous
      });

      if (reportError) throw reportError;

      // 3. Success!
      resetDraft();
      router.replace('/(tabs)/explore');
    } catch (err: any) {
      console.error('Failed to submit report:', err);
      setError(err.message || 'Failed to submit report');
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} 
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Review report</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Photo Preview */}
        {draft.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textDim }]}>
              Photos ({draft.photos.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
              {draft.photos.map((uri, index) => (
                <Image key={`${uri}-${index}`} source={{ uri }} style={styles.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Location Preview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Location</Text>
          <View style={[styles.infoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="mappin.and.ellipse" color={colors.accent} size={20} />
            <Text style={[styles.infoText, { color: colors.text }]}>{draft.location?.address}</Text>
          </View>
        </View>

        {/* Category Preview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Category</Text>
          <View style={[styles.infoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="square.grid.2x2.fill" color={colors.accent} size={20} />
            <Text style={[styles.infoText, { color: colors.text }]}>{draft.categoryName ?? 'Not selected'}</Text>
          </View>
        </View>

        {/* Description Input */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Description (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="Tell us more about the issue..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Anonymous Toggle */}
        <View style={[styles.toggleRow, { backgroundColor: colors.surface2 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Report anonymously</Text>
            <Text style={[styles.toggleSublabel, { color: colors.textDim }]}>Your name won&apos;t be shown publicly.</Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: colors.surface2, true: colors.accent }}
          />
        </View>

        {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.submitButton, { backgroundColor: colors.accent }, submitting && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Submit report</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F2EA',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  photoStrip: {
    flexDirection: 'row',
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 15,
    flex: 1,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  submitButton: {
    padding: 17,
    borderRadius: 14,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});

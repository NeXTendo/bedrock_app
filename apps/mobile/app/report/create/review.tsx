import { StyleSheet, View, Text, TouchableOpacity, Image, TextInput, ScrollView, Switch, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useReportStore } from '@/stores/reportStore';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReviewStepScreen() {
  const router = useRouter();
  const { draft, resetDraft } = useReportStore();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compressImage = async (uri: string) => {
    try {
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: SaveFormat.JPEG }
      );
      return result.uri;
    } catch (err) {
      console.error('Compression failed:', err);
      return uri; // Fallback to original
    }
  };

  const handleSubmit = async () => {
    if (!draft.location || !draft.category || !user) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Compress photo
      const originalPhoto = draft.photos[0];
      const compressedPhoto = await compressImage(originalPhoto);
      
      // 2. Upload photo to Supabase Storage
      const fileName = `${user.id}/${Date.now()}.jpg`;
      
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? compressedPhoto.replace('file://', '') : compressedPhoto,
        name: 'photo.jpg',
        type: 'image/jpeg',
      } as any);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(fileName, formData);

      if (uploadError) throw uploadError;

      // 2. Create report via RPC
      const { error: reportError } = await supabase.rpc('create_report', {
        p_category_id: draft.category,
        p_description: description,
        p_severity: draft.severity,
        p_lat: draft.location.latitude,
        p_lng: draft.location.longitude,
        p_address: draft.location.address,
        p_photo_urls: [uploadData.path],
        p_anonymous: isAnonymous
      });

      if (reportError) throw reportError;

      // 3. Success!
      resetDraft();
      router.replace('/(tabs)/explore');
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} 
          style={styles.backButton}
        >
          <IconSymbol name="chevron.right" color={theme.colors.text} size={24} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Report</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Photo Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PHOTO</Text>
          {draft.photos.length > 0 && (
            <Image source={{ uri: draft.photos[0] }} style={styles.photo} />
          )}
        </View>

        {/* Location Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOCATION</Text>
          <View style={styles.infoRow}>
            <IconSymbol name="paperplane.fill" color={theme.colors.accent} size={20} />
            <Text style={styles.infoText}>{draft.location?.address}</Text>
          </View>
        </View>

        {/* Category Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CATEGORY</Text>
          <View style={styles.infoRow}>
            <IconSymbol name="plus.circle.fill" color={theme.colors.accent} size={20} />
            <Text style={styles.infoText}>{draft.category}</Text>
          </View>
        </View>

        {/* Description Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESCRIPTION (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="Tell us more about the issue..."
            placeholderTextColor={theme.colors.textDim}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Anonymous Toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Report Anonymously</Text>
            <Text style={styles.toggleSublabel}>Your name won&apos;t be shown publicly.</Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: theme.colors.surface2, true: theme.colors.accent }}
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.submitButton, submitting && styles.disabledButton]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitText}>SUBMIT REPORT</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoText: {
    color: theme.colors.text,
    fontSize: 15,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    color: theme.colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface2,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  toggleLabel: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSublabel: {
    color: theme.colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: theme.colors.red,
    marginTop: 16,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  submitButton: {
    backgroundColor: theme.colors.accent,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
  },
});

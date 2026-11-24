import { Alert, Platform, StyleSheet, View, Text, TouchableOpacity, Image, TextInput, ScrollView, Switch, ActivityIndicator } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useReportStore } from '@/stores/reportStore';
import { useAppColors } from '@/hooks/useAppColors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { uploadImageAsync } from '@/lib/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getReportQuestions, type ReportAnswer } from '@/constants/reportQuestions';

interface SimilarPublicReport {
  id: string;
  description: string;
  address: string | null;
  created_at: string;
}

interface DuplicateCheckResult {
  key: string;
  reports: SimilarPublicReport[];
  error: string | null;
}

const severityOptions = [
  { value: 'low', label: 'Low', description: 'Minor issue with no immediate danger.' },
  { value: 'medium', label: 'Medium', description: 'Needs attention, but is not an immediate threat.' },
  { value: 'high', label: 'High', description: 'Serious impact or worsening quickly.' },
  { value: 'critical', label: 'Critical', description: 'Immediate danger to people or essential services.' },
] as const;

const answerOptions: { value: ReportAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
];

function distanceMeters(firstLat: number, firstLng: number, secondLat: number, secondLng: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(secondLat - firstLat);
  const lngDelta = radians(secondLng - firstLng);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(firstLat)) * Math.cos(radians(secondLat)) * Math.sin(lngDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ReviewStepScreen() {
  const router = useRouter();
  const { draft, resetDraft, setDraft } = useReportStore();
  const colors = useAppColors();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResult | null>(null);
  const [showIncidentPicker, setShowIncidentPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => (
    draft.occurredAt ? new Date(draft.occurredAt) : new Date()
  ));
  const reportQuestions = getReportQuestions(draft.categoryName);
  const reportCategory = draft.category;
  const reportLatitude = draft.location?.latitude;
  const reportLongitude = draft.location?.longitude;
  const duplicateCheckKey = reportLatitude !== undefined
    && reportLongitude !== undefined
    && reportCategory
    ? `${reportCategory}:${reportLatitude}:${reportLongitude}`
    : null;
  const currentDuplicateCheck = duplicateCheck?.key === duplicateCheckKey ? duplicateCheck : null;
  const checkingForDuplicates = !!duplicateCheckKey && !currentDuplicateCheck;

  const chooseIncidentDateTime = () => {
    const initialDate = draft.occurredAt ? new Date(draft.occurredAt) : new Date();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: 'date',
        maximumDate: new Date(),
        onValueChange: (_event, selectedDate) => {
          const date = new Date(initialDate);
          date.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onValueChange: (_timeEvent, selectedTime) => {
              const occurredAt = new Date(date);
              occurredAt.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
              if (occurredAt > new Date()) {
                Alert.alert('Invalid time', 'Choose a time that is not in the future.');
                return;
              }
              setDraft({ occurredAt: occurredAt.toISOString() });
            },
          });
        },
      });
      return;
    }

    setPickerDate(initialDate);
    setShowIncidentPicker(true);
  };

  const setCategoryAnswer = (key: string, value: ReportAnswer) => {
    setDraft({
      categoryDetails: {
        ...draft.categoryDetails,
        [key]: value,
      },
    });
  };

  useEffect(() => {
    if (!reportCategory || reportLatitude === undefined || reportLongitude === undefined) return;

    let active = true;
    const latitude = reportLatitude;
    const longitude = reportLongitude;
    const key = `${reportCategory}:${latitude}:${longitude}`;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const bounds = 0.02;

    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('public_reports')
          .select('id, description, address, latitude, longitude, status, created_at')
          .eq('category_id', reportCategory)
          .gte('latitude', latitude - bounds)
          .lte('latitude', latitude + bounds)
          .gte('longitude', longitude - bounds)
          .lte('longitude', longitude + bounds)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20);

        if (queryError) throw queryError;
        if (!active) return;

        const reports = (data || [])
          .filter(report =>
            !['RESOLVED', 'REJECTED'].includes(report.status)
            && distanceMeters(latitude, longitude, Number(report.latitude), Number(report.longitude)) <= 1500
          )
          .slice(0, 3)
          .map(report => ({
            id: report.id,
            description: report.description || 'No public summary available.',
            address: report.address,
            created_at: report.created_at,
          }));

        setDuplicateCheck({ key, reports, error: null });
      } catch (queryError: unknown) {
        console.error('Unable to check for similar public reports:', queryError);
        if (active) {
          setDuplicateCheck({
            key,
            reports: [],
            error: 'Could not check nearby public reports. You can still submit; the department will review it.',
          });
        }
      }
    })();

    return () => { active = false; };
  }, [reportCategory, reportLatitude, reportLongitude]);

  const handleSubmit = async () => {
    if (!draft.location || !draft.category || !user) return;

    setSubmitting(true);
    setError(null);
    const photoUrls: string[] = [];

    try {
      // 1. Upload photo(s) to Supabase Storage if present
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
      const { data: reportId, error: reportError } = await supabase.rpc('create_report', {
        p_category_id: draft.category,
        p_description: description,
        p_severity: draft.severity,
        p_occurred_at: draft.occurredAt,
        p_immediate_danger: draft.immediateDanger,
        p_category_details: draft.categoryDetails,
        p_lat: draft.location.latitude,
        p_lng: draft.location.longitude,
        p_address: draft.location.address,
        p_photo_urls: photoUrls,
        p_anonymous: isAnonymous
      });

      if (reportError) throw reportError;
      if (!reportId) throw new Error('Report submission did not return a report ID.');

      // 3. Success!
      resetDraft();
      router.replace(`/report/${reportId}`);
    } catch (err: any) {
      console.error('Failed to submit report:', err);
      if (photoUrls.length > 0) {
        const { error: cleanupError } = await supabase.storage
          .from('report-photos')
          .remove(photoUrls);
        if (cleanupError) {
          console.error('Unable to remove report photos after a failed submission:', cleanupError);
        }
      }
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

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDim }]}>How urgent is it?</Text>
          <View style={styles.severityOptions}>
            {severityOptions.map(option => {
              const selected = draft.severity === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.severityOption,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setDraft({ severity: option.value })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${option.label}: ${option.description}`}
                >
                  <View style={[styles.radioOuter, { borderColor: selected ? colors.accent : colors.textDim }]}>
                    {selected && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                  </View>
                  <View style={styles.severityText}>
                    <Text style={[styles.severityLabel, { color: colors.text }]}>{option.label}</Text>
                    <Text style={[styles.severityDescription, { color: colors.textDim }]}>
                      {option.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDim }]}>When did it happen?</Text>
          <View style={styles.timeOptions}>
            <TouchableOpacity
              style={[styles.timeOption, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setDraft({ occurredAt: new Date().toISOString() })}
              accessibilityRole="button"
            >
              <Text style={[styles.timeOptionText, { color: colors.text }]}>Happening now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timeOption, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={chooseIncidentDateTime}
              accessibilityRole="button"
            >
              <Text style={[styles.timeOptionText, { color: colors.text }]}>Choose date & time</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.timeOption,
                {
                  backgroundColor: colors.surface,
                  borderColor: draft.occurredAt === null ? colors.accent : colors.border,
                },
              ]}
              onPress={() => setDraft({ occurredAt: null })}
              accessibilityRole="radio"
              accessibilityState={{ checked: draft.occurredAt === null }}
            >
              <Text style={[styles.timeOptionText, { color: colors.text }]}>Not sure</Text>
            </TouchableOpacity>
          </View>
          {draft.occurredAt && (
            <Text style={[styles.selectedTime, { color: colors.textDim }]}>
              Selected: {new Date(draft.occurredAt).toLocaleString()}
            </Text>
          )}
          {showIncidentPicker && Platform.OS === 'ios' && (
            <View style={[styles.datePickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <DateTimePicker
                value={pickerDate}
                mode="datetime"
                display="spinner"
                maximumDate={new Date()}
                onValueChange={(_event, value) => setPickerDate(value)}
              />
              <View style={styles.datePickerActions}>
                <TouchableOpacity onPress={() => setShowIncidentPicker(false)}>
                  <Text style={[styles.datePickerAction, { color: colors.textDim }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (pickerDate > new Date()) {
                      Alert.alert('Invalid time', 'Choose a time that is not in the future.');
                      return;
                    }
                    setDraft({ occurredAt: pickerDate.toISOString() });
                    setShowIncidentPicker(false);
                  }}
                >
                  <Text style={[styles.datePickerAction, { color: colors.accent }]}>Use this time</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Is anyone in immediate danger?</Text>
          <View style={styles.answerOptions}>
            {answerOptions.map(option => {
              const selected = draft.immediateDanger === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.answerOption,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setDraft({ immediateDanger: option.value })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[styles.answerOptionText, { color: colors.text }]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.safetyNotice, { color: colors.error }]}>
            If someone is in immediate danger, contact local emergency services. This app is not monitored for emergencies.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textDim }]}>A few details about this issue</Text>
          <Text style={[styles.questionGuidance, { color: colors.textDim }]}>
            Answer only what you already know. Don’t approach a hazard to check; choose Unsure.
          </Text>
          {reportQuestions.map(question => (
            <View key={question.key} style={styles.question}>
              <Text style={[styles.questionPrompt, { color: colors.text }]}>{question.prompt}</Text>
              <View style={styles.answerOptions}>
                {answerOptions.map(option => {
                  const selected = draft.categoryDetails[question.key] === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.answerOption,
                        {
                          backgroundColor: colors.surface,
                          borderColor: selected ? colors.accent : colors.border,
                        },
                      ]}
                      onPress={() => setCategoryAnswer(question.key, option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${question.prompt} ${option.label}`}
                    >
                      <Text style={[styles.answerOptionText, { color: colors.text }]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {(checkingForDuplicates || currentDuplicateCheck?.error || (currentDuplicateCheck?.reports.length || 0) > 0) && (
          <View style={[styles.duplicateNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {checkingForDuplicates ? (
              <Text style={[styles.duplicateNoticeText, { color: colors.textDim }]}>
                Checking for similar published reports…
              </Text>
            ) : currentDuplicateCheck?.error ? (
              <Text style={[styles.duplicateNoticeText, { color: colors.textDim }]}>
                {currentDuplicateCheck.error}
              </Text>
            ) : (
              <>
                <Text style={[styles.duplicateNoticeTitle, { color: colors.text }]}>
                  Similar public reports may already exist nearby
                </Text>
                <Text style={[styles.duplicateNoticeText, { color: colors.textDim }]}>
                  These are approximate public summaries, not private reports. You can still submit; the department will review possible duplicates.
                </Text>
                {currentDuplicateCheck?.reports.map(similarReport => (
                  <TouchableOpacity
                    key={similarReport.id}
                    onPress={() => router.push(`/report/${similarReport.id}`)}
                    style={[styles.similarReport, { borderTopColor: colors.border }]}
                  >
                    <Text style={[styles.duplicateNoticeText, { color: colors.text }]} numberOfLines={2}>
                      {similarReport.description}
                    </Text>
                    {!!similarReport.address && (
                      <Text style={[styles.duplicateNoticeText, { color: colors.textDim }]} numberOfLines={1}>
                        {similarReport.address}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}

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
          disabled={submitting || checkingForDuplicates}
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
  duplicateNotice: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  duplicateNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  duplicateNoticeText: {
    fontSize: 12,
    lineHeight: 17,
  },
  similarReport: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    paddingTop: 8,
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
  severityOptions: {
    gap: 8,
  },
  severityOption: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  severityText: {
    flex: 1,
  },
  severityLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  severityDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  timeOptions: {
    gap: 8,
  },
  timeOption: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectedTime: {
    fontSize: 12,
    marginTop: 8,
  },
  datePickerCard: {
    marginTop: 12,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  datePickerAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  answerOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  answerOption: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  answerOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  safetyNotice: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  questionGuidance: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  question: {
    marginTop: 12,
  },
  questionPrompt: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 8,
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

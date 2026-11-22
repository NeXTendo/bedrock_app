import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

import { supabase } from '@/lib/supabase';
import { uploadImageAsync } from '@/lib/storage';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

const LUSAKA_WARDS = [
  'Ward 8 · Rhodes Park / Fairview',
  'Ward 19 · Kabwata',
  'Ward 12 · Chilenje',
  'Ward 3 · Roma / Olympia',
  'Ward 6 · Longacres / Woodlands',
  'Ward 10 · Chawama',
  'Ward 14 · Kanyama',
  'Ward 16 · Matero',
  'Ward 20 · Avondale / Chelston',
  'Ward 4 · Northmead / Garden',
];

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuthStore();
  const { theme: storeTheme, hapticsEnabled, anonymousByDefault, toggleAnonymousByDefault } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' ? (systemColorScheme || 'light') : storeTheme;
  const colors = theme[currentTheme as 'light' | 'dark'];

  // Form states
  const [fullNameOverride, setFullNameOverride] = useState<string | null>(null);
  const [phoneOverride, setPhoneOverride] = useState<string | null>(null);
  const [selectedWard, setSelectedWard] = useState('Ward 8 · Rhodes Park / Fairview');
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Security password state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Fetch current profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not logged in');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const fullName = fullNameOverride ?? profile?.full_name ?? '';
  const phone = phoneOverride ?? profile?.phone ?? '';
  const avatarUri = avatarOverride ?? profile?.avatar_url ?? null;
  const setFullName = setFullNameOverride;
  const setPhone = setPhoneOverride;
  const setAvatarUri = setAvatarOverride;

  // Pick Image from library
  const handlePickImage = async () => {
    if (hapticsEnabled) Haptics.selectionAsync();

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow camera roll access to update your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  // Take photo with camera
  const handleTakePhoto = async () => {
    if (hapticsEnabled) Haptics.selectionAsync();

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow camera access to take a profile photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  // Upload avatar to Supabase
  const uploadAvatar = async (localUri: string) => {
    if (!user?.id) return;
    try {
      setIsUploadingPhoto(true);
      const fileName = `avatars/${user.id}-${Date.now()}.jpg`;

      const uploadRes = await uploadImageAsync(localUri, fileName, {
        bucket: 'report-photos',
        maxWidth: 400,
        quality: 0.8,
        upsert: true,
      });

      const publicUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-photos/${uploadRes.path}`;
      setAvatarUri(publicUrl);
    } catch (err) {
      console.error('Avatar upload error:', err);
      // If storage upload fails, use local URI preview
      setAvatarUri(localUri);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Save profile updates
  const handleSaveProfile = async () => {
    if (!user?.id) return;
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      setSavingProfile(true);
      setSaveSuccessMsg(false);

      const updates = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        avatar_url: avatarUri,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Update auth user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          ward: selectedWard,
        },
      });

      // Invalidate profile query so changes reflect everywhere
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });

      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3500);

      Alert.alert('Profile Saved', 'Your user profile information has been updated successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Unable to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change password
  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'New password and confirmation do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Password Updated', 'Your account password has been changed.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out of your Bedrock citizen account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centerScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textDim }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
        >
          <IconSymbol name="chevron.left" color={colors.text} size={18} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile Settings</Text>
        <TouchableOpacity
          onPress={handleSaveProfile}
          disabled={savingProfile}
          style={[styles.saveHeaderBtn, { backgroundColor: colors.accent }]}
        >
          {savingProfile ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveHeaderBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 80,
          paddingHorizontal: 16,
        }}
      >
        {/* ── Success Banner ── */}
        {saveSuccessMsg && (
          <View style={[styles.successBanner, { backgroundColor: colors.success + '20', borderColor: colors.success + '40' }]}>
            <IconSymbol name="checkmark.circle.fill" color={colors.success} size={16} />
            <Text style={[styles.successBannerText, { color: colors.success }]}>
              Profile changes saved to municipal registry.
            </Text>
          </View>
        )}

        {/* ── Avatar Edit Card ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionLabel, { color: colors.textDim }]}>Profile photo</Text>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarWrap, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Text style={[styles.avatarInitial, { color: colors.text }]}>
                  {fullName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'C'}
                </Text>
              )}
              {isUploadingPhoto && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
            </View>

            <View style={styles.avatarActions}>
              <TouchableOpacity
                onPress={handlePickImage}
                style={[styles.photoBtn, { backgroundColor: colors.accent }]}
                disabled={isUploadingPhoto}
              >
                <IconSymbol name="photo.fill" color="#fff" size={13} />
                <Text style={styles.photoBtnText}>Choose photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleTakePhoto}
                style={[styles.photoBtnOutline, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
                disabled={isUploadingPhoto}
              >
                <IconSymbol name="camera.fill" color={colors.text} size={13} />
                <Text style={[styles.photoBtnOutlineText, { color: colors.text }]}>Take photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Identity & Contact Form ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionLabel, { color: colors.textDim }]}>Personal details</Text>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textDim }]}>Full name</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <IconSymbol name="person.fill" color={colors.textDim} size={15} />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textDim}
                style={[styles.textInput, { color: colors.text }]}
              />
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textDim }]}>Phone number</Text>
            <View style={[styles.inputBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <IconSymbol name="phone.fill" color={colors.textDim} size={15} />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+260 97X XXX XXX"
                placeholderTextColor={colors.textDim}
                keyboardType="phone-pad"
                style={[styles.textInput, { color: colors.text }]}
              />
            </View>
            <Text style={[styles.fieldHint, { color: colors.textDim }]}>
              Used for dispatch verification calls and resolution SMS alerts.
            </Text>
          </View>

          {/* Email Address (Read-only) */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={[styles.fieldLabel, { color: colors.textDim }]}>Email address</Text>
              <View style={[styles.verifiedBadge, { backgroundColor: colors.success + '18' }]}>
                <IconSymbol name="checkmark.circle.fill" color={colors.success} size={10} />
                <Text style={[styles.verifiedBadgeText, { color: colors.success }]}>Verified</Text>
              </View>
            </View>
            <View style={[styles.inputBoxDisabled, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <IconSymbol name="lock.fill" color={colors.textDim} size={14} />
              <Text style={[styles.disabledInputText, { color: colors.textDim }]}>
                {user?.email || 'citizen@bedrock.app'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Residential Ward Selection ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionLabel, { color: colors.textDim }]}>Primary ward & community</Text>
          <Text style={[styles.cardSectionDesc, { color: colors.textDim }]}>
            Select your residential area to prioritize local alerts, ward waste schedules, and civic bulletins.
          </Text>

          <View style={styles.wardList}>
            {LUSAKA_WARDS.map((ward) => {
              const isSelected = selectedWard === ward;
              return (
                <TouchableOpacity
                  key={ward}
                  onPress={() => {
                    if (hapticsEnabled) Haptics.selectionAsync();
                    setSelectedWard(ward);
                  }}
                  style={[
                    styles.wardRow,
                    { borderColor: colors.border, backgroundColor: isSelected ? colors.accentSoft : 'transparent' },
                    isSelected && { borderColor: colors.accent },
                  ]}
                >
                  <IconSymbol
                    name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                    color={isSelected ? colors.accent : colors.textDim}
                    size={16}
                  />
                  <Text style={[styles.wardName, { color: isSelected ? colors.accent : colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                    {ward}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Civic Privacy & Report Preferences ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardSectionLabel, { color: colors.textDim }]}>Civic privacy</Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>Submit anonymously by default</Text>
              <Text style={[styles.switchDesc, { color: colors.textDim }]}>
                Hides your name and phone from the public community map. Municipal dispatch still receives verification logs.
              </Text>
            </View>
            <Switch
              value={anonymousByDefault}
              onValueChange={toggleAnonymousByDefault}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={Platform.OS === 'android' ? (anonymousByDefault ? '#fff' : colors.surface2) : undefined}
            />
          </View>
        </View>

        {/* ── Password & Security ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setShowPasswordSection(!showPasswordSection)}
            style={styles.accordionHeader}
          >
            <View style={styles.accordionLeft}>
              <IconSymbol name="shield.fill" color={colors.accent} size={15} />
              <Text style={[styles.cardSectionLabel, { color: colors.text, marginBottom: 0 }]}>
                Change password
              </Text>
            </View>
            <IconSymbol
              name={showPasswordSection ? 'chevron.up' : 'chevron.down'}
              color={colors.textDim}
              size={14}
            />
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={styles.passwordBody}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textDim }]}>New password</Text>
                <View style={[styles.inputBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Min 6 characters"
                    placeholderTextColor={colors.textDim}
                    secureTextEntry
                    style={[styles.textInput, { color: colors.text }]}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textDim }]}>Confirm new password</Text>
                <View style={[styles.inputBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repeat new password"
                    placeholderTextColor={colors.textDim}
                    secureTextEntry
                    style={[styles.textInput, { color: colors.text }]}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleUpdatePassword}
                disabled={changingPassword}
                style={[styles.updatePasswordBtn, { backgroundColor: colors.accent }]}
              >
                {changingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.updatePasswordBtnText}>Update password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Save Profile Button ── */}
        <TouchableOpacity
          onPress={handleSaveProfile}
          disabled={savingProfile}
          style={[styles.primarySaveBtn, { backgroundColor: colors.accent }]}
          activeOpacity={0.8}
        >
          {savingProfile ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primarySaveBtnText}>Save profile changes</Text>
          )}
        </TouchableOpacity>

        {/* ── Account Actions (Sign out) ── */}
        <View style={styles.dangerZone}>
          <TouchableOpacity
            onPress={handleSignOut}
            style={[styles.signOutBtn, { borderColor: colors.error + '40', backgroundColor: colors.error + '10' }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="rectangle.portrait.and.arrow.right" color={colors.error} size={15} />
            <Text style={[styles.signOutBtnText, { color: colors.error }]}>Sign out of account</Text>
          </TouchableOpacity>
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
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  saveHeaderBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Success banner */
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  successBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Card */
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  cardSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardSectionDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },

  /* Avatar */
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '700',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActions: {
    flex: 1,
    gap: 8,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  photoBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  photoBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  photoBtnOutlineText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Fields */
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    marginBottom: 5,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  inputBoxDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    opacity: 0.8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  disabledInputText: {
    fontSize: 13,
  },
  fieldHint: {
    fontSize: 10,
    marginTop: 4,
  },

  /* Wards */
  wardList: {
    gap: 6,
  },
  wardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  wardName: {
    fontSize: 12,
  },

  /* Switch */
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  switchDesc: {
    fontSize: 11,
    lineHeight: 15,
  },

  /* Accordion */
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordBody: {
    paddingTop: 14,
  },
  updatePasswordBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  updatePasswordBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Primary Save */
  primarySaveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  primarySaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Danger zone */
  dangerZone: {
    paddingTop: 8,
    marginBottom: 24,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

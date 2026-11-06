import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Switch, 
  TouchableOpacity, 
  useColorScheme, 
  Alert 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { theme } from '@/constants/theme';
import { 
  useSettingsStore, 
  ThemeMode, 
  MapStyleMode, 
  AlertRadius 
} from '@/stores/useSettingsStore';
import { usePermissions } from '@/hooks/usePermissions';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheSize, setCacheSize] = useState('24.8 MB');

  const {
    theme: storeTheme,
    mapStyle,
    hapticsEnabled,
    notificationsEnabled,
    statusUpdateNotifications,
    nearbyAlerts,
    alertRadiusKm,
    communityFeedbackAlerts,
    lowDataMode,
    wifiOnlyUpload,
    offlineSyncEnabled,
    anonymousByDefault,
    highAccuracyGps,
    saveToCameraRoll,
    addTimestampWatermark,
    setTheme,
    setMapStyle,
    toggleHaptics,
    toggleNotifications,
    toggleStatusUpdates,
    toggleNearbyAlerts,
    setAlertRadius,
    toggleCommunityFeedback,
    toggleLowDataMode,
    toggleWifiOnlyUpload,
    toggleOfflineSync,
    toggleAnonymousByDefault,
    toggleHighAccuracyGps,
    toggleSaveToCameraRoll,
    toggleTimestampWatermark,
    resetToDefaults,
  } = useSettingsStore();

  const { permissions, requestPermission } = usePermissions();

  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];

  const themeOptions: { label: string; value: ThemeMode; icon: string }[] = [
    { label: 'Light', value: 'light', icon: 'sun.max.fill' },
    { label: 'Dark', value: 'dark', icon: 'moon.stars.fill' },
    { label: 'System', value: 'auto', icon: 'iphone' },
  ];

  const mapOptions: { label: string; value: MapStyleMode }[] = [
    { label: 'Standard', value: 'standard' },
    { label: 'Satellite', value: 'satellite' },
    { label: 'Hybrid', value: 'hybrid' },
  ];

  const radiusOptions: AlertRadius[] = [1, 3, 5, 10];

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove temporary map tiles, cached thumbnails, and local report previews. Your saved account data will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Now',
          style: 'destructive',
          onPress: () => {
            setClearingCache(true);
            setTimeout(() => {
              setCacheSize('0.0 KB');
              setClearingCache(false);
              Alert.alert('Cache Cleared', 'Temporary media cache has been reset.');
            }, 700);
          },
        },
      ]
    );
  };

  const handleResetDefaults = () => {
    Alert.alert(
      'Reset All Settings',
      'Reset all app preferences, radar distances, and appearance modes back to factory defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetToDefaults();
            Alert.alert('Preferences Reset', 'All settings have been restored to defaults.');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader 
        title="Settings"
        subtitle="SYSTEM PREFERENCES"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <IconSymbol name="chevron.left" color={colors.text} size={20} />
          </TouchableOpacity>
        }
        rightElement={<View style={{ width: 36 }} />}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* APPEARANCE & MAP */}
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>APPEARANCE & DISPLAY</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Theme Selector */}
          <View style={styles.settingPaddedRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Theme Interface</Text>
            <Text style={[styles.settingDesc, { color: colors.textDim }]}>Select your preferred visual mode</Text>
          </View>
          <View style={styles.segmentedContainer}>
            {themeOptions.map((option) => {
              const isSelected = storeTheme === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setTheme(option.value)}
                  style={[
                    styles.segmentButton,
                    { backgroundColor: isSelected ? colors.surface2 : 'transparent', borderColor: isSelected ? colors.accent : colors.border }
                  ]}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    name={option.icon as any} 
                    color={isSelected ? colors.accent : colors.textDim} 
                    size={16} 
                  />
                  <Text style={[
                    styles.segmentLabel, 
                    { color: isSelected ? colors.text : colors.textDim, fontWeight: isSelected ? '700' : '500' }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          {/* Map Layer Style */}
          <View style={styles.settingPaddedRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Map Base Layer</Text>
            <Text style={[styles.settingDesc, { color: colors.textDim }]}>Choose default rendering for map feeds</Text>
          </View>
          <View style={styles.segmentedContainer}>
            {mapOptions.map((option) => {
              const isSelected = mapStyle === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setMapStyle(option.value)}
                  style={[
                    styles.segmentButton,
                    { backgroundColor: isSelected ? colors.surface2 : 'transparent', borderColor: isSelected ? colors.accent : colors.border }
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentLabel, 
                    { color: isSelected ? colors.text : colors.textDim, fontWeight: isSelected ? '700' : '500' }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          {/* Haptics */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Haptic Tactile Feedback</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Vibrations for interactions, votes, and filters</Text>
            </View>
            <Switch 
              value={hapticsEnabled} 
              onValueChange={toggleHaptics}
              trackColor={{ false: colors.surface2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* NOTIFICATIONS & RADAR */}
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>INCIDENT ALERTS & NOTIFICATIONS</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Push Notifications</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Master toggle for all device alerts</Text>
            </View>
            <Switch 
              value={notificationsEnabled} 
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.surface2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          {notificationsEnabled && (
            <>
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Report Status Updates</Text>
                  <Text style={[styles.settingDesc, { color: colors.textDim }]}>Instant alerts when crews triage or resolve your reports</Text>
                </View>
                <Switch 
                  value={statusUpdateNotifications} 
                  onValueChange={toggleStatusUpdates}
                  trackColor={{ false: colors.surface2, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Nearby Incident Radar</Text>
                  <Text style={[styles.settingDesc, { color: colors.textDim }]}>Alerts for critical infrastructure hazards in your area</Text>
                </View>
                <Switch 
                  value={nearbyAlerts} 
                  onValueChange={toggleNearbyAlerts}
                  trackColor={{ false: colors.surface2, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              {nearbyAlerts && (
                <View style={[styles.subOptionBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[styles.subOptionTitle, { color: colors.text }]}>Radar Radius Distance</Text>
                  <View style={styles.radiusRow}>
                    {radiusOptions.map((rad) => {
                      const isSelected = alertRadiusKm === rad;
                      return (
                        <TouchableOpacity
                          key={rad}
                          onPress={() => setAlertRadius(rad)}
                          style={[
                            styles.radiusChip,
                            { 
                              backgroundColor: isSelected ? colors.accent : colors.surface,
                              borderColor: isSelected ? colors.accent : colors.border
                            }
                          ]}
                        >
                          <Text style={[
                            styles.radiusChipText,
                            { color: isSelected ? '#FFFFFF' : colors.textDim, fontWeight: isSelected ? '800' : '600' }
                          ]}>
                            {rad} km
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Community Verifications</Text>
                  <Text style={[styles.settingDesc, { color: colors.textDim }]}>When citizens confirm or support your submitted reports</Text>
                </View>
                <Switch 
                  value={communityFeedbackAlerts} 
                  onValueChange={toggleCommunityFeedback}
                  trackColor={{ false: colors.surface2, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
            </>
          )}
        </View>

        {/* DATA & OFFLINE */}
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>DATA SAVER & STORAGE</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Data Saver Mode</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Compress photos and reduce background network usage</Text>
            </View>
            <Switch 
              value={lowDataMode} 
              onValueChange={toggleLowDataMode}
              trackColor={{ false: colors.surface2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Upload Evidence on Wi-Fi Only</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Queue high-resolution media until connected to Wi-Fi</Text>
            </View>
            <Switch 
              value={wifiOnlyUpload} 
              onValueChange={toggleWifiOnlyUpload}
              trackColor={{ false: colors.surface2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Offline Sync Queue</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Save reports locally if cellular signal is lost</Text>
            </View>
            <Switch 
              value={offlineSyncEnabled} 
              onValueChange={toggleOfflineSync}
              trackColor={{ false: colors.surface2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          {/* Cache Action */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Local Cached Media</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Map tiles and report preview cache: {cacheSize}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.surface2 }]} 
              onPress={handleClearCache}
              disabled={clearingCache}
            >
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                {clearingCache ? 'CLEARING...' : 'CLEAR'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* PRIVACY & GEO-LOCATION */}
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>PRIVACY & LOCATION</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>High-Precision Geolocation</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Uses GPS hardware for sub-meter pin accuracy</Text>
            </View>
            <Switch 
              value={highAccuracyGps} 
              onValueChange={toggleHighAccuracyGps}
              trackColor={{ false: colors.surface2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Anonymous Submissions</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Hide your username from public community feeds by default</Text>
            </View>
            <Switch 
              value={anonymousByDefault} 
              onValueChange={toggleAnonymousByDefault}
              trackColor={{ false: colors.surface2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* CAMERA & EVIDENCE */}
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>CAMERA & EVIDENCE</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Save to Device Camera Roll</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Keep a copy of taken incident photos in your device library</Text>
            </View>
            <Switch 
              value={saveToCameraRoll} 
              onValueChange={toggleSaveToCameraRoll}
              trackColor={{ false: colors.surface2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>GPS & Timestamp Watermark</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Embed verified coordinates and time into report evidence</Text>
            </View>
            <Switch 
              value={addTimestampWatermark} 
              onValueChange={toggleTimestampWatermark}
              trackColor={{ false: colors.surface2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* SYSTEM PERMISSIONS */}
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>SYSTEM PERMISSIONS</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PermissionItem 
            label="Location Services" 
            desc="Required for automatic incident geotagging"
            status={permissions.location} 
            icon="location.fill" 
            onPress={() => requestPermission('location')}
            colors={colors}
          />
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <PermissionItem 
            label="Camera Hardware" 
            desc="Used for capturing visual proof of hazards"
            status={permissions.camera} 
            icon="camera.fill" 
            onPress={() => requestPermission('camera')}
            colors={colors}
          />
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <PermissionItem 
            label="Photo Library" 
            desc="Attach existing photos from gallery"
            status={permissions.photos} 
            icon="photo.fill" 
            onPress={() => requestPermission('photos')}
            colors={colors}
          />
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <PermissionItem 
            label="Emergency Contacts" 
            desc="Quick dispatch to local safety contacts"
            status={permissions.contacts} 
            icon="person.2.fill" 
            onPress={() => requestPermission('contacts')}
            colors={colors}
          />
        </View>

        {/* SYSTEM STATUS & ACTIONS */}
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>SYSTEM DIAGNOSTICS & RESET</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>City Gateway Status</Text>
              <Text style={[styles.settingDesc, { color: colors.textDim }]}>Supabase Realtime Sync Engine</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: colors.success + '20', borderColor: colors.success + '40' }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.statusText, { color: colors.success }]}>ONLINE</Text>
            </View>
          </View>

          <View style={[styles.separator, { backgroundColor: colors.border }]} />

          <TouchableOpacity 
            style={[styles.settingRow, { justifyContent: 'center' }]} 
            onPress={handleResetDefaults}
            activeOpacity={0.7}
          >
            <Text style={[styles.resetText, { color: colors.error }]}>Reset All Settings to Factory Default</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.version, { color: colors.text }]}>BEDROCK CIVIC MOBILE</Text>
          <Text style={[styles.subVersion, { color: colors.textDim }]}>v2.4.0 • Build 2026.09.18 • Expo 55</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function PermissionItem({ label, desc, status, icon, onPress, colors }: any) {
  const isGranted = status === 'granted';
  
  return (
    <TouchableOpacity 
      style={styles.settingRow} 
      onPress={onPress} 
      disabled={isGranted}
      activeOpacity={0.7}
    >
      <View style={styles.permissionInfo}>
        <View style={[styles.iconContainer, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          <IconSymbol name={icon} color={colors.accent} size={16} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.settingDesc, { color: colors.textDim }]}>{desc}</Text>
        </View>
      </View>
      <View style={[
        styles.statusBadge, 
        { 
          backgroundColor: isGranted ? colors.success + '15' : colors.warning + '15',
          borderColor: isGranted ? colors.success + '35' : colors.warning + '35'
        }
      ]}>
        <Text style={[
          styles.statusText, 
          { color: isGranted ? colors.success : colors.warning }
        ]}>
          {isGranted ? 'GRANTED' : 'REQUEST'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    paddingHorizontal: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 28,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingPaddedRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  segmentedContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1,
    gap: 6,
  },
  segmentLabel: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  subOptionBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
  },
  subOptionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
  },
  radiusChipText: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  separator: {
    height: 1,
    marginHorizontal: 16,
  },
  permissionInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  resetText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footer: {
    marginTop: 36,
    alignItems: 'center',
    gap: 3,
  },
  version: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  subVersion: {
    fontSize: 11,
    fontWeight: '500',
  },
});

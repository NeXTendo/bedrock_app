import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
  Alert,
  useColorScheme,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSettingsStore } from '@/stores/useSettingsStore';
import * as Haptics from 'expo-haptics';

// ─── Data Definitions ─────────────────────────────────────────────────────────

interface EmergencyContact {
  id: string;
  name: string;
  category: 'emergency' | 'utility' | 'council';
  phone: string;
  displayPhone: string;
  desc: string;
  icon: string;
  color: string;
  available: string;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'police',
    name: 'Zambia Police Emergency',
    category: 'emergency',
    phone: '991',
    displayPhone: '991 / 0211 228 923',
    desc: 'Central command & urgent civic response',
    icon: 'shield.fill',
    color: '#3b82f6',
    available: '24/7 Toll-free',
  },
  {
    id: 'zesco',
    name: 'ZESCO Power Faults',
    category: 'utility',
    phone: '0211363636',
    displayPhone: '0211 363 636 / 0977 797 979',
    desc: 'High voltage faults, lines down & outages',
    icon: 'bolt.fill',
    color: '#f59e0b',
    available: '24/7 National Dispatch',
  },
  {
    id: 'water',
    name: 'Lusaka Water & Sewerage (LWSC)',
    category: 'utility',
    phone: '0211251712',
    displayPhone: '0211 251 712 / 0955 798 888',
    desc: 'Pipe bursts, sewer overflows & contamination',
    icon: 'drop.fill',
    color: '#06b6d4',
    available: '24/7 Rapid Response',
  },
  {
    id: 'fire',
    name: 'Fire & Rescue Brigade',
    category: 'emergency',
    phone: '993',
    displayPhone: '993 / 0211 220 180',
    desc: 'Fire suppression, building collapse & rescues',
    icon: 'flame.fill',
    color: '#ef4444',
    available: '24/7 Emergency',
  },
  {
    id: 'ambulance',
    name: 'National Emergency Ambulance',
    category: 'emergency',
    phone: '992',
    displayPhone: '992 / 0977 123 992',
    desc: 'Critical medical transport & paramedic dispatch',
    icon: 'cross.case.fill',
    color: '#10b981',
    available: '24/7 Dispatch',
  },
  {
    id: 'council',
    name: 'Lusaka City Council (LCC)',
    category: 'council',
    phone: '0211252501',
    displayPhone: '0211 252 501',
    desc: 'Civic complaints, public health & road safety',
    icon: 'building.2.fill',
    color: '#8b5cf6',
    available: 'Mon–Fri 08:00–17:00',
  },
];

interface OutageBulletin {
  id: string;
  type: 'power' | 'water' | 'road';
  title: string;
  status: 'active' | 'scheduled' | 'restored';
  provider: string;
  affectedAreas: string[];
  window: string;
  estRestore: string;
  details: string;
  severity: 'high' | 'moderate' | 'low';
}

const OUTAGE_BULLETINS: OutageBulletin[] = [
  {
    id: 'outage-1',
    type: 'power',
    title: 'Substation Transformer Overhaul',
    status: 'scheduled',
    provider: 'ZESCO Central District',
    affectedAreas: ['Rhodes Park', 'Fairview', 'Northmead', 'Villa Elizabetha'],
    window: 'Tomorrow · 08:00 – 14:00',
    estRestore: '14:00 hrs',
    details: 'Scheduled preventive maintenance on primary step-down transformers to reinforce feeder line reliability before seasonal rainstorms.',
    severity: 'high',
  },
  {
    id: 'outage-2',
    type: 'water',
    title: 'Main Trunk Line Valve Repair',
    status: 'active',
    provider: 'Lusaka Water & Sanitation (LWSC)',
    affectedAreas: ['Kabulonga', 'Ibex Hill', 'Woodlands Extension'],
    window: 'Today · In progress',
    estRestore: '18:30 hrs today',
    details: 'Crews are on site replacing a ruptured 450mm isolation gate valve. Water bowsers dispatched to clinic areas in Kabulonga.',
    severity: 'high',
  },
  {
    id: 'outage-3',
    type: 'road',
    title: 'Culvert & Stormwater Drainage Upgrade',
    status: 'active',
    provider: 'LCC Engineering Services',
    affectedAreas: ['Lumumba Road (near City Market)', 'CBD West'],
    window: 'Ongoing · Lane restrictions',
    estRestore: 'Sunday, 17:00 hrs',
    details: 'Upgrading concrete culverts to prevent flash flooding. Inbound right lane closed; motorists advised to use Kafue Road bypass.',
    severity: 'moderate',
  },
  {
    id: 'outage-4',
    type: 'power',
    title: 'Feeder Line Cleared & Restored',
    status: 'restored',
    provider: 'ZESCO East Region',
    affectedAreas: ['Roma', 'Foxdale', 'Chamba Valley'],
    window: 'Earlier today',
    estRestore: 'Fully restored',
    details: 'Vegetation clearing completed along the high-tension reserve corridor. Grid stability normalized.',
    severity: 'low',
  },
];

interface WardSchedule {
  id: string;
  wardNumber: number;
  name: string;
  pickupDays: string;
  pickupTime: string;
  operator: string;
  depotAddress: string;
  nextPickup: string;
  wasteTypes: string[];
}

const WARD_SCHEDULES: WardSchedule[] = [
  {
    id: 'w-19',
    wardNumber: 19,
    name: 'Kabwata',
    pickupDays: 'Tuesdays & Fridays',
    pickupTime: '07:00 – 11:30',
    operator: 'Lusaka Waste Management Unit (Zone C)',
    depotAddress: 'Kabwata Community Centre depot, Chilimbulu Rd',
    nextPickup: 'Friday morning',
    wasteTypes: ['Household waste', 'Dry recyclables'],
  },
  {
    id: 'w-8',
    wardNumber: 8,
    name: 'Rhodes Park / Fairview',
    pickupDays: 'Mondays & Thursdays',
    pickupTime: '06:30 – 10:00',
    operator: 'Clean City Green Tech Ltd (Franchise)',
    depotAddress: 'Church Rd Service yard, adjacent to Fire Station',
    nextPickup: 'Tomorrow morning',
    wasteTypes: ['Domestic waste', 'Garden trim', 'Paper & Cardboard'],
  },
  {
    id: 'w-12',
    wardNumber: 12,
    name: 'Chilenje',
    pickupDays: 'Wednesdays & Saturdays',
    pickupTime: '07:30 – 12:00',
    operator: 'Lusaka South Solid Waste JV',
    depotAddress: 'Chilenje South Market Civic Bay',
    nextPickup: 'Saturday morning',
    wasteTypes: ['General waste', 'Compostables'],
  },
  {
    id: 'w-3',
    wardNumber: 3,
    name: 'Roma / Olympia',
    pickupDays: 'Tuesdays & Saturdays',
    pickupTime: '06:30 – 11:00',
    operator: 'Capital Waste Logistics',
    depotAddress: 'Katima Mulilo Civic depot',
    nextPickup: 'Saturday morning',
    wasteTypes: ['Domestic refuse', 'Garden waste', 'Plastic & glass'],
  },
  {
    id: 'w-6',
    wardNumber: 6,
    name: 'Longacres / Woodlands',
    pickupDays: 'Mondays & Thursdays',
    pickupTime: '07:00 – 11:00',
    operator: 'LCC Direct Fleet',
    depotAddress: 'Woodlands Stadium perimeter waste yard',
    nextPickup: 'Thursday morning',
    wasteTypes: ['Domestic refuse', 'Separated plastics'],
  },
];

type ServiceTab = 'all' | 'hotlines' | 'bulletins' | 'waste';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const router = useRouter();
  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' ? (systemColorScheme || 'light') : storeTheme;
  const colors = theme[currentTheme as 'light' | 'dark'];
  const isDark = currentTheme === 'dark';

  const [activeTab, setActiveTab] = useState<ServiceTab>('all');
  const [selectedWardId, setSelectedWardId] = useState<string>('w-8');
  const [bulletinFilter, setBulletinFilter] = useState<'all' | 'active' | 'scheduled'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const currentWard = useMemo(() => {
    return WARD_SCHEDULES.find(w => w.id === selectedWardId) || WARD_SCHEDULES[0];
  }, [selectedWardId]);

  const handleCall = (phone: string, name: string) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      `Call ${name}`,
      `Dial ${phone}? Direct connection to official dispatch.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Now',
          style: 'default',
          onPress: () => Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`),
        },
      ]
    );
  };

  const handleShareBulletin = (b: OutageBulletin) => {
    if (hapticsEnabled) Haptics.selectionAsync();
    Share.share({
      message: `[Bedrock Civic Alert] ${b.title} (${b.provider}): ${b.window}. Affected: ${b.affectedAreas.join(', ')}. Est. restore: ${b.estRestore}.`,
    });
  };

  const filteredBulletins = useMemo(() => {
    return OUTAGE_BULLETINS.filter(b => {
      if (bulletinFilter === 'active' && b.status !== 'active') return false;
      if (bulletinFilter === 'scheduled' && b.status !== 'scheduled') return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          b.title.toLowerCase().includes(q) ||
          b.affectedAreas.some(a => a.toLowerCase().includes(q)) ||
          b.provider.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bulletinFilter, searchFilter]);

  const filteredContacts = useMemo(() => {
    if (!searchFilter.trim()) return EMERGENCY_CONTACTS;
    const q = searchFilter.toLowerCase();
    return EMERGENCY_CONTACTS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.displayPhone.includes(q)
    );
  }, [searchFilter]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ── Top Header ── */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: isDark ? 'rgba(12,11,9,0.95)' : 'rgba(253,249,243,0.95)',
          borderBottomColor: colors.border,
        }
      ]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Services & Directory</Text>
            <Text style={[styles.screenSubtitle, { color: colors.textDim }]}>
              Ward schedules, emergency hotlines & utility bulletins
            </Text>
          </View>
          <View style={[styles.cityBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent + '35' }]}>
            <IconSymbol name="mappin.circle.fill" color={colors.accent} size={12} />
            <Text style={[styles.cityBadgeText, { color: colors.accent }]}>Lusaka</Text>
          </View>
        </View>

        {/* ── Search Input ── */}
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" color={colors.textDim} size={15} />
          <TextInput
            placeholder="Search ward, utility, hotline or area..."
            placeholderTextColor={colors.textDim}
            value={searchFilter}
            onChangeText={setSearchFilter}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchFilter.length > 0 && (
            <TouchableOpacity onPress={() => setSearchFilter('')}>
              <IconSymbol name="xmark.circle.fill" color={colors.textDim} size={16} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filter Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsTrack}
        >
          {[
            { id: 'all', label: 'Overview' },
            { id: 'hotlines', label: 'Emergency hotlines' },
            { id: 'bulletins', label: 'Utility bulletins' },
            { id: 'waste', label: 'Ward waste schedule' },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => {
                  if (hapticsEnabled) Haptics.selectionAsync();
                  setActiveTab(tab.id as ServiceTab);
                }}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: active ? colors.accent : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                  }
                ]}
              >
                <Text style={[
                  styles.tabChipText,
                  { color: active ? '#ffffff' : colors.text }
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 150,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 16,
        }}
      >
        {/* ── Section: Emergency & Utility Hotlines ── */}
        {(activeTab === 'all' || activeTab === 'hotlines') && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Emergency & utility hotlines</Text>
              <Text style={[styles.sectionSub, { color: colors.textDim }]}>One-tap direct dial</Text>
            </View>

            <View style={styles.hotlinesGrid}>
              {filteredContacts.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleCall(contact.phone, contact.name)}
                  activeOpacity={0.75}
                >
                  <View style={styles.contactTopRow}>
                    <View style={[styles.contactIconWrap, { backgroundColor: contact.color + '18' }]}>
                      <IconSymbol name={contact.icon} color={contact.color} size={16} />
                    </View>
                    <View style={[styles.callBtn, { backgroundColor: colors.accentSoft }]}>
                      <IconSymbol name="phone.fill" color={colors.accent} size={12} />
                      <Text style={[styles.callBtnText, { color: colors.accent }]}>Call</Text>
                    </View>
                  </View>

                  <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
                    {contact.name}
                  </Text>
                  <Text style={[styles.contactDesc, { color: colors.textDim }]} numberOfLines={2}>
                    {contact.desc}
                  </Text>

                  <View style={[styles.contactFooter, { borderTopColor: colors.border }]}>
                    <Text style={[styles.contactPhone, { color: colors.text }]}>{contact.displayPhone}</Text>
                    <Text style={[styles.contactAvail, { color: colors.textDim }]}>{contact.available}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Section: Ward Waste & Sanitation Schedules ── */}
        {(activeTab === 'all' || activeTab === 'waste') && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Ward waste pickup schedule</Text>
                <Text style={[styles.sectionSub, { color: colors.textDim }]}>Lusaka municipal solid waste collection</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: colors.surface2 }]}>
                <Text style={[styles.countBadgeText, { color: colors.textDim }]}>Ward {currentWard.wardNumber}</Text>
              </View>
            </View>

            {/* Ward selector pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.wardPillTrack}
              style={{ marginHorizontal: -16, marginBottom: 12 }}
            >
              {WARD_SCHEDULES.map((w) => {
                const isSelected = w.id === selectedWardId;
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => {
                      if (hapticsEnabled) Haptics.selectionAsync();
                      setSelectedWardId(w.id);
                    }}
                    style={[
                      styles.wardPill,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.border,
                      }
                    ]}
                  >
                    <Text style={[styles.wardPillText, { color: isSelected ? '#fff' : colors.text }]}>
                      Ward {w.wardNumber}: {w.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Active ward schedule card */}
            <View style={[styles.scheduleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.scheduleTopRow}>
                <View style={[styles.scheduleIconCircle, { backgroundColor: colors.accentSoft }]}>
                  <IconSymbol name="trash.fill" color={colors.accent} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scheduleWardTitle, { color: colors.text }]}>
                    Ward {currentWard.wardNumber} — {currentWard.name}
                  </Text>
                  <Text style={[styles.scheduleOperator, { color: colors.textDim }]}>
                    Managed by {currentWard.operator}
                  </Text>
                </View>
                <View style={[styles.nextPickupPill, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.nextPickupText, { color: colors.success }]}>
                    {currentWard.nextPickup}
                  </Text>
                </View>
              </View>

              <View style={[styles.scheduleGrid, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                <View style={styles.scheduleGridItem}>
                  <Text style={[styles.scheduleLabel, { color: colors.textDim }]}>Pickup days</Text>
                  <Text style={[styles.scheduleVal, { color: colors.text }]}>{currentWard.pickupDays}</Text>
                </View>
                <View style={styles.scheduleGridItem}>
                  <Text style={[styles.scheduleLabel, { color: colors.textDim }]}>Collection hours</Text>
                  <Text style={[styles.scheduleVal, { color: colors.text }]}>{currentWard.pickupTime}</Text>
                </View>
              </View>

              <View style={styles.wasteTypesRow}>
                <Text style={[styles.scheduleLabel, { color: colors.textDim, marginBottom: 6 }]}>
                  Accepted categories:
                </Text>
                <View style={styles.wasteChipsWrap}>
                  {currentWard.wasteTypes.map((type, idx) => (
                    <View key={idx} style={[styles.wasteChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                      <IconSymbol name="checkmark.circle.fill" color={colors.accent} size={10} />
                      <Text style={[styles.wasteChipText, { color: colors.text }]}>{type}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.depotRow, { backgroundColor: colors.surface2 }]}>
                <IconSymbol name="mappin" color={colors.accent} size={13} />
                <Text style={[styles.depotText, { color: colors.textDim }]} numberOfLines={1}>
                  Depot: {currentWard.depotAddress}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Section: Utility Outage & Maintenance Bulletins ── */}
        {(activeTab === 'all' || activeTab === 'bulletins') && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Utility maintenance & outages</Text>
                <Text style={[styles.sectionSub, { color: colors.textDim }]}>Live civic infrastructure advisories</Text>
              </View>
              <View style={styles.bulletinFilterTabs}>
                {(['all', 'active', 'scheduled'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => {
                      if (hapticsEnabled) Haptics.selectionAsync();
                      setBulletinFilter(f);
                    }}
                    style={[
                      styles.bulletinSubTab,
                      bulletinFilter === f && { backgroundColor: colors.accentSoft, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={[
                      styles.bulletinSubTabText,
                      { color: bulletinFilter === f ? colors.accent : colors.textDim }
                    ]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {filteredBulletins.map((bulletin) => {
              const statusColor = bulletin.status === 'active'
                ? '#ef4444'
                : bulletin.status === 'scheduled'
                ? '#f59e0b'
                : '#10b981';

              const iconName = bulletin.type === 'power'
                ? 'bolt.fill'
                : bulletin.type === 'water'
                ? 'drop.fill'
                : 'car.fill';

              return (
                <View
                  key={bulletin.id}
                  style={[styles.bulletinCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.bulletinHeader}>
                    <View style={[styles.bulletinTypeIcon, { backgroundColor: statusColor + '18' }]}>
                      <IconSymbol name={iconName} color={statusColor} size={14} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bulletinTitle, { color: colors.text }]}>{bulletin.title}</Text>
                      <Text style={[styles.bulletinProvider, { color: colors.textDim }]}>{bulletin.provider}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
                      <Text style={[styles.statusChipText, { color: statusColor }]}>
                        {bulletin.status.charAt(0).toUpperCase() + bulletin.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.bulletinDetails, { color: colors.text }]}>
                    {bulletin.details}
                  </Text>

                  <View style={[styles.bulletinTimingBox, { backgroundColor: colors.surface2 }]}>
                    <View style={styles.timingItem}>
                      <IconSymbol name="calendar" color={colors.textDim} size={11} />
                      <Text style={[styles.timingText, { color: colors.textDim }]}>{bulletin.window}</Text>
                    </View>
                    <View style={styles.timingItem}>
                      <IconSymbol name="clock.fill" color={colors.accent} size={11} />
                      <Text style={[styles.timingText, { color: colors.accent, fontWeight: '600' }]}>
                        Restoration: {bulletin.estRestore}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.affectedSection}>
                    <Text style={[styles.affectedLabel, { color: colors.textDim }]}>Affected areas:</Text>
                    <View style={styles.affectedTagsWrap}>
                      {bulletin.affectedAreas.map((area, idx) => (
                        <View key={idx} style={[styles.areaTag, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                          <Text style={[styles.areaTagText, { color: colors.text }]}>{area}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.bulletinFooter, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      onPress={() => handleShareBulletin(bulletin)}
                      style={styles.shareAction}
                    >
                      <IconSymbol name="square.and.arrow.up" color={colors.accent} size={13} />
                      <Text style={[styles.shareActionText, { color: colors.accent }]}>Share alert</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Section: Quick Report Shortcut ── */}
        <View style={[styles.reportPromptCard, { backgroundColor: colors.surface, borderColor: colors.accent + '40' }]}>
          <View style={[styles.reportPromptIcon, { backgroundColor: colors.accentSoft }]}>
            <IconSymbol name="exclamationmark.triangle.fill" color={colors.accent} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reportPromptTitle, { color: colors.text }]}>Notice an unreported utility outage?</Text>
            <Text style={[styles.reportPromptDesc, { color: colors.textDim }]}>
              Log a rapid report with GPS coordinates to alert dispatch crews in your ward.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(tabs)/report' as any);
            }}
            style={[styles.reportPromptBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.reportPromptBtnText}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* ── Municipal Footer ── */}
        <View style={styles.registryFooter}>
          <IconSymbol name="checkmark.shield.fill" color={colors.accent} size={15} />
          <Text style={[styles.registryFooterText, { color: colors.textDim }]}>
            Connected with Lusaka City Council, ZESCO & LWSC Public Utility Registries.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  cityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterTabsTrack: {
    gap: 6,
    paddingBottom: 2,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Sections */
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  /* Hotlines Grid */
  hotlinesGrid: {
    gap: 10,
  },
  contactCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  contactTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  callBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  contactDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
  },
  contactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  contactPhone: {
    fontSize: 11,
    fontWeight: '600',
  },
  contactAvail: {
    fontSize: 10,
  },

  /* Ward Waste Schedule */
  wardPillTrack: {
    paddingHorizontal: 16,
    gap: 8,
  },
  wardPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  wardPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  scheduleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  scheduleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleWardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  scheduleOperator: {
    fontSize: 11,
    marginTop: 1,
  },
  nextPickupPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  nextPickupText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scheduleGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  scheduleGridItem: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  scheduleVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  wasteTypesRow: {
    marginBottom: 10,
  },
  wasteChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  wasteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  wasteChipText: {
    fontSize: 10,
    fontWeight: '500',
  },
  depotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  depotText: {
    fontSize: 11,
  },

  /* Bulletins */
  bulletinFilterTabs: {
    flexDirection: 'row',
    gap: 4,
  },
  bulletinSubTab: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bulletinSubTabText: {
    fontSize: 10,
    fontWeight: '600',
  },
  bulletinCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  bulletinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  bulletinTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulletinTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  bulletinProvider: {
    fontSize: 10,
    marginTop: 1,
  },
  statusChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 9,
    fontWeight: '700',
  },
  bulletinDetails: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  bulletinTimingBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  timingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timingText: {
    fontSize: 10,
  },
  affectedSection: {
    marginBottom: 10,
  },
  affectedLabel: {
    fontSize: 10,
    marginBottom: 4,
  },
  affectedTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  areaTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  areaTagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  bulletinFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareActionText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Report Prompt Card */
  reportPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  reportPromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportPromptTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  reportPromptDesc: {
    fontSize: 10,
    lineHeight: 14,
  },
  reportPromptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  reportPromptBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Registry Footer */
  registryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  registryFooterText: {
    fontSize: 10,
    textAlign: 'center',
  },
});

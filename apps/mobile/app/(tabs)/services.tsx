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

type ServiceTab = 'hotlines' | 'bulletins' | 'waste';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const router = useRouter();
  const { theme: storeTheme, hapticsEnabled } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' ? (systemColorScheme || 'light') : storeTheme;
  const colors = theme[currentTheme as 'light' | 'dark'];

  const [activeTab, setActiveTab] = useState<ServiceTab>('hotlines');
  const [selectedWardId, setSelectedWardId] = useState<string>('w-8');
  const [wasteDetailsExpanded, setWasteDetailsExpanded] = useState(false);
  const [bulletinFilter, setBulletinFilter] = useState<'all' | 'active' | 'scheduled'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const currentWard = useMemo(() => {
    return WARD_SCHEDULES.find(w => w.id === selectedWardId) || WARD_SCHEDULES[0];
  }, [selectedWardId]);

  const handleCall = async (phone: string, name: string) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);
    } catch {
      Alert.alert('Unable to start call', `Please try dialing ${name} directly: ${phone}`);
    }
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.pageContent,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* ── Page header and section selector ── */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={[styles.screenTitle, { color: colors.text }]}>Services</Text>
              <Text style={[styles.screenSubtitle, { color: colors.textDim }]}>
                Get help and check local updates.
              </Text>
            </View>
            <View style={[styles.cityBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent + '35' }]}>
              <IconSymbol name="mappin.circle.fill" color={colors.accent} size={12} />
              <Text style={[styles.cityBadgeText, { color: colors.accent }]}>Lusaka</Text>
            </View>
          </View>

          {activeTab !== 'waste' && (
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="magnifyingglass" color={colors.textDim} size={15} />
              <TextInput
                placeholder={activeTab === 'hotlines' ? 'Search contacts' : 'Search outages'}
                placeholderTextColor={colors.textDim}
                value={searchFilter}
                onChangeText={setSearchFilter}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {searchFilter.length > 0 && (
                <TouchableOpacity onPress={() => setSearchFilter('')} accessibilityLabel="Clear search">
                  <IconSymbol name="xmark.circle.fill" color={colors.textDim} size={16} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={[styles.filterTabsTrack, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            {[
              { id: 'hotlines', label: 'Hotlines' },
              { id: 'bulletins', label: 'Outages' },
              { id: 'waste', label: 'Waste' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => {
                    if (hapticsEnabled) Haptics.selectionAsync();
                    setActiveTab(tab.id as ServiceTab);
                    setSearchFilter('');
                  }}
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: active ? colors.surface : 'transparent',
                      borderColor: active ? colors.border : 'transparent',
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabChipText, { color: active ? colors.text : colors.textDim }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.content}>
        {activeTab === 'hotlines' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Call a service</Text>
              <Text style={[styles.sectionSub, { color: colors.textDim }]}>Tap to open dialer</Text>
            </View>

            <View style={styles.hotlinesGrid}>
              {[...filteredContacts]
                .sort((a, b) => {
                  const priority = { emergency: 0, utility: 1, council: 2 };
                  return priority[a.category] - priority[b.category];
                })
                .map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleCall(contact.phone, contact.name)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${contact.name}, ${contact.displayPhone}. ${contact.desc}. ${contact.available}`}
                >
                  <View style={[styles.contactIconWrap, { backgroundColor: colors.accentSoft }]}>
                    <IconSymbol name={contact.icon} color={colors.accent} size={17} />
                  </View>
                  <View style={styles.contactDetails}>
                    <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
                      {contact.name}
                    </Text>
                    <Text style={[styles.contactDesc, { color: colors.textDim }]} numberOfLines={1}>
                      {contact.desc}
                    </Text>
                    <Text style={[styles.contactPhone, { color: colors.text }]}>{contact.displayPhone}</Text>
                    <Text style={[styles.contactAvail, { color: colors.textDim }]}>{contact.available}</Text>
                  </View>
                  <View style={[styles.callBtn, { backgroundColor: colors.accentSoft }]}>
                    <IconSymbol name="phone.fill" color={colors.accent} size={13} />
                    <Text style={[styles.callBtnText, { color: colors.accent }]}>Call</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {filteredContacts.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyStateText, { color: colors.textDim }]}>No contacts match your search.</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Section: Ward Waste & Sanitation Schedules ── */}
        {activeTab === 'waste' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Waste pickup</Text>
                <Text style={[styles.sectionSub, { color: colors.textDim }]}>Select your ward</Text>
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
                </View>
                <View style={[styles.nextPickupPill, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.nextPickupText, { color: colors.success }]}>
                    Next: {currentWard.nextPickup}
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

              <TouchableOpacity
                style={styles.scheduleDetailsToggle}
                onPress={() => setWasteDetailsExpanded(value => !value)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ expanded: wasteDetailsExpanded }}
              >
                <Text style={[styles.scheduleDetailsToggleText, { color: colors.accent }]}>
                  {wasteDetailsExpanded ? 'Hide schedule details' : 'More schedule details'}
                </Text>
                <IconSymbol
                  name={wasteDetailsExpanded ? 'chevron.up' : 'chevron.down'}
                  color={colors.accent}
                  size={13}
                />
              </TouchableOpacity>

              {wasteDetailsExpanded && (
                <View style={styles.wasteDetails}>
                  <Text style={[styles.scheduleOperator, { color: colors.textDim }]}>
                    Managed by {currentWard.operator}
                  </Text>
                  <View style={styles.wasteTypesRow}>
                    <Text style={[styles.scheduleLabel, { color: colors.textDim, marginBottom: 6 }]}>
                      Accepted categories
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
                      {currentWard.depotAddress}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Section: Utility Outage & Maintenance Bulletins ── */}
        {activeTab === 'bulletins' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Service updates</Text>
                <Text style={[styles.sectionSub, { color: colors.textDim }]}>Outages and scheduled work</Text>
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
                ? colors.error
                : bulletin.status === 'scheduled'
                ? colors.warning
                : colors.success;

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

                  <Text style={[styles.bulletinDetails, { color: colors.text }]} numberOfLines={2}>
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
                    <Text style={[styles.affectedAreasText, { color: colors.text }]} numberOfLines={2}>
                      {bulletin.affectedAreas.join(' · ')}
                    </Text>
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
            {filteredBulletins.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyStateText, { color: colors.textDim }]}>
                  {searchFilter ? 'No updates match your search.' : `No ${bulletinFilter} updates to show.`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Quick report shortcut ── */}
        <TouchableOpacity
          style={[styles.reportPromptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {
            if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/(tabs)/report' as any);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Report a service issue"
        >
          <View style={[styles.reportPromptIcon, { backgroundColor: colors.accentSoft }]}>
            <IconSymbol name="plus.circle.fill" color={colors.accent} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reportPromptTitle, { color: colors.text }]}>Report a service issue</Text>
            <Text style={[styles.reportPromptDesc, { color: colors.textDim }]}>
              Send a new issue to the city team.
            </Text>
          </View>
          <IconSymbol name="chevron.right" color={colors.textDim} size={14} />
        </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pageContent: {
    paddingHorizontal: 16,
  },
  content: {
    paddingTop: 4,
  },

  /* Header */
  header: {
    paddingBottom: 12,
    marginBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  screenSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  cityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterTabsTrack: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 13,
    borderWidth: 1,
  },
  tabChip: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Sections */
  section: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 1,
  },
  /* Hotlines */
  hotlinesGrid: {
    gap: 8,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 15,
    borderWidth: 1,
    padding: 11,
  },
  contactIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactDetails: { flex: 1 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
  },
  contactDesc: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
    marginBottom: 3,
  },
  contactPhone: {
    fontSize: 12,
    fontWeight: '700',
  },
  contactAvail: {
    fontSize: 10,
    marginTop: 1,
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
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
  scheduleDetailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  scheduleDetailsToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  wasteDetails: {
    paddingTop: 12,
    gap: 10,
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
    borderRadius: 16,
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
    borderRadius: 9,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 9,
    fontWeight: '700',
  },
  bulletinDetails: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  bulletinTimingBox: {
    gap: 7,
    padding: 10,
    borderRadius: 11,
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
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  affectedAreasText: {
    fontSize: 12,
    lineHeight: 17,
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
    fontSize: 12,
    fontWeight: '600',
  },

  /* Quick report action */
  reportPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 4,
  },
  reportPromptIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  reportPromptDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  emptyState: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 13,
  },
});

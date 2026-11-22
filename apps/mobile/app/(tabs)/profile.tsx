import { StyleSheet, View, Text, TouchableOpacity, ScrollView, useColorScheme, Image } from 'react-native';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { AppHeader } from '@/components/AppHeader';

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme } = useSettingsStore();

  const currentTheme = storeTheme === 'auto' 
    ? (systemColorScheme || 'light') 
    : storeTheme;
  
  const colors = theme[currentTheme as 'light' | 'dark'];

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      const { count: totalReports, error: reportsError } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      const { count: resolvedReports, error: resolvedError } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('status', 'RESOLVED');

      if (reportsError || resolvedError) throw reportsError || resolvedError;
      
      return {
        total: totalReports || 0,
        resolved: resolvedReports || 0
      };
    },
    enabled: !!user,
  });

  const getRoleLabel = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'Administrator';
      case 'staff': return 'Staff';
      default: return 'Citizen';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader 
        title="Profile"
        rightElement={
          <TouchableOpacity 
            onPress={signOut} 
            style={[styles.logoutBtn, { backgroundColor: colors.error + '15', borderColor: colors.error + '30' }]}
            activeOpacity={0.7}
          >
            <IconSymbol name="rectangle.portrait.and.arrow.right" color={colors.error} size={16} />
          </TouchableOpacity>
        }
      />

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[styles.content, { paddingTop: 20, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + identity */}
        <View style={styles.identitySection}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {profile?.avatar_url ? (
                <Image 
                  source={{ uri: profile.avatar_url }} 
                  style={styles.avatarImage} 
                />
              ) : (
                <Text style={[styles.avatarInitial, { color: colors.text }]}>
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              )}
            </View>
            <TouchableOpacity 
              style={[styles.editAvatar, { backgroundColor: colors.accent, borderColor: colors.background }]}
              onPress={() => router.push('/profile/settings' as any)}
              activeOpacity={0.8}
            >
              <IconSymbol name="camera.fill" color={colors.background} size={11} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.userName, { color: colors.text }]}>
            {profile?.full_name || 'Anonymous citizen'}
          </Text>

          <View style={[styles.roleBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent + '30' }]}>
            <Text style={[styles.roleText, { color: colors.accent }]}>
              {getRoleLabel(profile?.role)}
            </Text>
          </View>

          <Text style={[styles.userEmail, { color: colors.textDim }]}>{user?.email}</Text>

          <View style={styles.memberSinceRow}>
            <IconSymbol name="calendar" color={colors.textDim} size={11} />
            <Text style={[styles.memberSince, { color: colors.textDim }]}>
              Member since {profile?.created_at 
                ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) 
                : '2026'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.editProfileBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/profile/settings' as any)}
            activeOpacity={0.7}
          >
            <IconSymbol name="person.crop.circle" color={colors.accent} size={14} />
            <Text style={[styles.editProfileBtnText, { color: colors.text }]}>Edit citizen profile</Text>
            <IconSymbol name="chevron.right" color={colors.textDim} size={12} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats?.total || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>Reports</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats?.resolved || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>Resolved</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.highlight }]}>{profile?.xp_points || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>XP</Text>
          </View>
        </View>

        {/* Menu sections */}
        <MenuSection title="Account & Activity" colors={colors}>
          <MenuRow icon="person.crop.circle"    label="Profile settings"   onPress={() => router.push('/profile/settings' as any)} colors={colors} />
          <MenuRow icon="list.bullet"           label="My reports"        onPress={() => router.push('/profile/history')} colors={colors} />
          <MenuRow icon="mappin.circle.fill"    label="Saved locations"   onPress={() => router.push('/profile/saved-locations')} colors={colors} />
        </MenuSection>

        <MenuSection title="Support" colors={colors}>
          <MenuRow icon="info.circle.fill"      label="Help & guidelines" onPress={() => router.push('/profile/help')} colors={colors} />
          <MenuRow icon="shield.fill"           label="About Bedrock"     onPress={() => router.push('/profile/about')} colors={colors} />
        </MenuSection>

        <Text style={[styles.version, { color: colors.textMuted }]}>Bedrock v2.4.0</Text>
      </ScrollView>
    </View>
  );
}

function MenuSection({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={styles.menuSection}>
      <Text style={[styles.menuSectionTitle, { color: colors.textDim }]}>{title}</Text>
      <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function MenuRow({ icon, label, onPress, colors }: { icon: string; label: string; onPress: () => void; colors: any }) {
  return (
    <TouchableOpacity 
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconWrap, { backgroundColor: colors.accentSoft }]}>
        <IconSymbol name={icon as any} color={colors.accent} size={15} />
      </View>
      <Text style={[styles.menuRowLabel, { color: colors.text }]}>{label}</Text>
      <IconSymbol name="chevron.right" color={colors.textMuted} size={13} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },

  identitySection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 14,
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: '700',
  },
  editAvatar: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 6,
  },
  memberSinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberSince: {
    fontSize: 12,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  statsRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statItem: { alignItems: 'center' },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    height: '60%',
    alignSelf: 'center',
  },

  menuSection: { marginBottom: 18 },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },

  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 16,
  },
});

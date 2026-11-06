import { AppHeader } from '@/components/AppHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { theme } from '@/constants/theme';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const { theme: storeTheme } = useSettingsStore();

  const currentTheme = storeTheme === 'auto'
    ? (systemColorScheme || 'light')
    : storeTheme;

  const colors = theme[currentTheme as 'light' | 'dark'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="About Bedrock"
        subtitle="SYSTEM INFO"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" color={colors.text} size={24} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 100, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="house.fill" color={colors.text} size={40} />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>BEDROCK</Text>
          <Text style={[styles.appVersion, { color: colors.textDim }]}>OFFICIAL GOVERNMENT RELEASE v1.0.0</Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>MISSION STATEMENT</Text>
          <Text style={[styles.cardText, { color: colors.textDim }]}>
            Bedrock is the a platform for civic engagement and infrastructure maintenance reporting.
            Our mission is to foster transparency and efficiency in municipal services through
            data-driven communication between citizens and government departments.
          </Text>
        </View>

        <View style={styles.linkSection}>
          <AboutLink label="Terms of Service" colors={colors} />
          <AboutLink label="Privacy Policy" colors={colors} />
          <AboutLink label="Open Source Licenses" colors={colors} />
          <AboutLink label="Official Government Website" colors={colors} />
        </View>

        <Text style={[styles.copyright, { color: colors.textDim }]}>
          © 2026 Bedrock Municipal Systems. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

function AboutLink({ label, colors }: any) {
  return (
    <TouchableOpacity style={[styles.linkItem, { borderBottomColor: colors.border }]}>
      <Text style={[styles.linkLabel, { color: colors.text }]}>{label}</Text>
      <IconSymbol name="chevron.right" color={colors.textDim} size={14} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginVertical: 40,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  appVersion: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 1,
  },
  infoCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  linkSection: {
    marginBottom: 40,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  copyright: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.6,
  },
});

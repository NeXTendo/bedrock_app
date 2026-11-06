import { StyleSheet, View, Text, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { AppHeader } from '@/components/AppHeader';

export default function HelpCenterScreen() {
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
        title="Help Center"
        subtitle="OFFICIAL SUPPORT"
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
        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>GENERAL GUIDANCE</Text>
        
        <HelpItem 
          title="How to submit a report"
          desc="Learn how to document and submit infrastructure issues effectively."
          colors={colors}
        />
        <HelpItem 
          title="Tracking status updates"
          desc="Understand what each status label means for your submission."
          colors={colors}
        />
        <HelpItem 
          title="Verified Citizen status"
          desc="Learn about official identity verification and its benefits."
          colors={colors}
        />

        <Text style={[styles.sectionTitle, { color: colors.textDim, marginTop: 32 }]}>CONTACT OFFICIALS</Text>
        
        <TouchableOpacity style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.contactIcon, { backgroundColor: colors.info + '15' }]}>
            <IconSymbol name="paperplane.fill" color={colors.info} size={20} />
          </View>
          <View>
            <Text style={[styles.contactLabel, { color: colors.text }]}>Email Support</Text>
            <Text style={[styles.contactValue, { color: colors.textDim }]}>support@bedrock.gov</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
          <View style={[styles.contactIcon, { backgroundColor: colors.success + '15' }]}>
            <IconSymbol name="plus.circle.fill" color={colors.success} size={20} />
          </View>
          <View>
            <Text style={[styles.contactLabel, { color: colors.text }]}>Emergency Hotline</Text>
            <Text style={[styles.contactValue, { color: colors.textDim }]}>+1 (800) BEDROCK</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function HelpItem({ title, desc, colors }: any) {
  return (
    <TouchableOpacity style={[styles.helpItem, { borderBottomColor: colors.border }]}>
      <View style={styles.helpTextContainer}>
        <Text style={[styles.helpTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.helpDesc, { color: colors.textDim }]}>{desc}</Text>
      </View>
      <IconSymbol name="chevron.right" color={colors.textDim} size={14} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  helpTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  helpDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  contactValue: {
    fontSize: 13,
    marginTop: 2,
  },
});

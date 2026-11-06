import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useReportStore } from '@/stores/reportStore';
import { theme } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Category {
  id: string;
  name: string;
  icon: string;
}

export default function CategoryStepScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setDraft } = useReportStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, icon')
          .order('sort_order', { ascending: true });
        
        if (error) throw error;
        setCategories(data || []);
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, []);

  const handleSelect = (categoryId: string) => {
    setDraft({ category: categoryId });
    router.push('/report/create/review');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.right" color={theme.colors.text} size={24} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Category</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>What kind of issue are you reporting?</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        ) : (
          <View style={styles.grid}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat.id} 
                style={styles.card}
                onPress={() => handleSelect(cat.id)}
              >
                <View style={styles.iconContainer}>
                  <IconSymbol name="plus.circle.fill" color={theme.colors.accent} size={32} />
                </View>
                <Text style={styles.cardName}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 20,
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
  loadingContainer: {
    paddingTop: 100,
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontSize: 16,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    backgroundColor: theme.colors.surface,
    width: '47%',
    aspectRatio: 1,
    borderRadius: 16,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconContainer: {
    marginBottom: 12,
  },
  cardName: {
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
  },
});

//TrainingAcademy
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, ShopHeader } from '../../components';
import { listTrainingCategories } from '../../services/api';
import type { TrainingCategory } from '../../types';
import { colors, spacing, typography } from '../../theme';
import type { AccountStackParamList } from '../../navigation/accountTypes';

const CATEGORY_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
];

export function TrainingAcademyScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AccountStackParamList>>();

  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTrainingCategories();
      setCategories(data.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Training Academy" />

      {/* Hero banner */}
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🎓</Text>
        <Text style={styles.heroTitle}>Learn & Grow</Text>
        <Text style={styles.heroSubtitle}>
          Access training materials curated to help you succeed
        </Text>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={categories}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={
            <Text style={styles.empty}>No training categories yet. Check back soon!</Text>
          }
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item: cat, index }) => {
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('TrainingMaterials', {
                    categoryId: cat.id,
                    categoryName: cat.name,
                  })
                }
                style={[styles.catCard, { borderTopColor: color }]}
              >
                <View style={[styles.catIconWrap, { backgroundColor: `${color}20` }]}>
                  <Text style={styles.catIcon}>📚</Text>
                </View>
                <Text style={styles.catName}>{cat.name}</Text>
                {cat.description ? (
                  <Text style={styles.catDesc} numberOfLines={2}>
                    {cat.description}
                  </Text>
                ) : null}
                <Text style={[styles.catLink, { color }]}>View Materials →</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  heroEmoji: { fontSize: 40 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center' },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  row: { gap: spacing.md },
  catCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderTopWidth: 3,
    flex: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  catIconWrap: { alignSelf: 'flex-start', borderRadius: 10, padding: spacing.sm },
  catIcon: { fontSize: 22 },
  catName: { ...typography.body, color: colors.text, fontWeight: '700' },
  catDesc: { ...typography.caption, color: colors.textSecondary },
  catLink: { ...typography.caption, fontWeight: '600', marginTop: spacing.xs },
  empty: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl },
  errorWrap: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  error: { ...typography.bodySmall, color: colors.error },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: { color: '#fff', fontWeight: '700' },
});

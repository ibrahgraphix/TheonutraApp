//TrainingMaterials
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackRouteProp } from '@react-navigation/native-stack';

import { ListItem, ShopHeader } from '../../components';
import { listMaterialsByCategory } from '../../services/api';
import type { TrainingMaterial } from '../../types';
import { colors, spacing, typography } from '../../theme';
import type { AccountStackParamList } from '../../navigation/accountTypes';

type RouteProp = NativeStackRouteProp<AccountStackParamList, 'TrainingMaterials'>;

export function TrainingMaterialsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp>();
  const { categoryId, categoryName } = route.params;

  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMaterialsByCategory(categoryId);
      setMaterials(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => { void load(); }, [load]);

  const openPdf = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title={categoryName} />

      <FlatList
        contentContainerStyle={styles.content}
        data={materials}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.empty}>No materials in this category yet.</Text>
          </View>
        }
        ListHeaderComponent={
          error ? <Text style={styles.error}>{error}</Text> : null
        }
        renderItem={({ item: mat }) => (
          <TouchableOpacity
            onPress={() => void openPdf(mat.pdf_url)}
            style={styles.materialCard}
          >
            <View style={styles.pdfIcon}>
              <Text style={styles.pdfIconText}>📄</Text>
            </View>
            <View style={styles.materialInfo}>
              <Text style={styles.materialTitle}>{mat.title}</Text>
              {mat.description ? (
                <Text style={styles.materialDesc} numberOfLines={2}>
                  {mat.description}
                </Text>
              ) : null}
              <Text style={styles.openLink}>Tap to open PDF →</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  materialCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  pdfIcon: {
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pdfIconText: { fontSize: 24 },
  materialInfo: { flex: 1, gap: spacing.xs },
  materialTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  materialDesc: { ...typography.bodySmall, color: colors.textSecondary },
  openLink: { ...typography.caption, color: colors.primary, fontWeight: '600', marginTop: spacing.xs },
  emptyWrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  emptyIcon: { fontSize: 48 },
  empty: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.bodySmall, color: colors.error, textAlign: 'center' },
});

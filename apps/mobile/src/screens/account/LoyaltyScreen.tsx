import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, ShopHeader } from '../../components';
import { getMyLoyalty } from '../../services/api';
import type { LoyaltyData } from '../../types';
import { colors, spacing, typography } from '../../theme';

export function LoyaltyScreen() {
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyLoyalty(1, 30);
      setLoyalty(data);
    } catch {
      // keep null
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  const transactions = loyalty?.history?.transactions ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ShopHeader title="Loyalty Points" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pointsBanner}>
          <Text style={styles.points}>{(loyalty?.balance ?? 0).toLocaleString()}</Text>
          <Text style={styles.pointsSubLabel}>Loyalty Points</Text>
        </View>

        <Text style={styles.sectionTitle}>Points History</Text>
        {transactions.length ? (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txLeft}>
                <Text style={styles.txDesc}>{tx.source_type}</Text>
                <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.txPoints, tx.type === 'earn' ? styles.earn : styles.redeem]}>
                {tx.type === 'earn' ? '+' : '-'}{tx.points}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No loyalty transactions yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  pointsBanner: {
    alignItems: 'center', borderRadius: 20, gap: spacing.xs,
    padding: spacing.xxl, backgroundColor: colors.primary,
  },
  points: { color: '#fff', fontSize: 52, fontWeight: '900', lineHeight: 60 },
  pointsSubLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  sectionTitle: { ...typography.h3, color: colors.text },
  txRow: {
    backgroundColor: colors.surface, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md,
  },
  txLeft: { flex: 1, gap: 2 },
  txDesc: { ...typography.bodySmall, color: colors.text },
  txDate: { ...typography.caption, color: colors.textSecondary },
  txPoints: { ...typography.body, fontWeight: '700' },
  earn: { color: '#10b981' },
  redeem: { color: colors.error },
  empty: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
});
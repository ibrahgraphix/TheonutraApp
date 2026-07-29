import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { formatCurrency } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageOPB'>;

// Add these three to services/api.ts if not already present:
//
// export async function getPendingOPBBonuses(): Promise<any[]> {
//   const response = await fetch(`${API_BASE_URL}/api/compensation/opb/pending`, {
//     headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
//   });
//   if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to fetch OPB bonuses'));
//   return response.json();
// }
//
// export async function approveOPB(id: string): Promise<void> {
//   const response = await fetch(`${API_BASE_URL}/api/compensation/opb/${encodeURIComponent(id)}/approve`, {
//     method: 'PATCH',
//     headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
//   });
//   if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to approve OPB bonus'));
// }
//
// export async function rejectOPB(id: string): Promise<void> {
//   const response = await fetch(`${API_BASE_URL}/api/compensation/opb/${encodeURIComponent(id)}/reject`, {
//     method: 'PATCH',
//     headers: { Authorization: currentAuthToken ? `Bearer ${currentAuthToken}` : '' },
//   });
//   if (!response.ok) throw new Error(parseApiError(await response.text(), 'Failed to reject OPB bonus'));
// }

import { getPendingOPBBonuses, approveOPB, rejectOPB } from '../../services/api';

export function ManageOPBScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getPendingOPBBonuses()
      .then(setBonuses)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await approveOPB(id);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to approve.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await rejectOPB(id);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="OPB Bonuses" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : bonuses.length === 0 ? (
        <Text style={styles.empty}>No pending OPB bonuses.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={bonuses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Text style={styles.name}>{item.profiles?.full_name ?? 'Unknown'}</Text>
              <Text style={styles.meta}>{item.profiles?.distributor_id} · Period {item.period}</Text>
              <Text style={styles.amount}>{formatCurrency(Number(item.bonus_amount), 'USD')}</Text>
              <Text style={styles.detail}>
                QGV: {Number(item.qualified_group_volume).toLocaleString()} · {item.opb_percent}%
              </Text>
              <View style={styles.actionsRow}>
                <Button
                  loading={processingId === item.id}
                  onPress={() => handleApprove(item.id)}
                  style={styles.actionBtn}
                  title="Approve"
                />
                <Button
                  loading={processingId === item.id}
                  onPress={() => handleReject(item.id)}
                  style={styles.actionBtn}
                  title="Reject"
                  variant="outline"
                />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  empty: { ...typography.body, color: colors.textSecondary, padding: spacing.xxl, textAlign: 'center' },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { gap: spacing.xs },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.h3, color: colors.primary, marginTop: spacing.xs },
  detail: { ...typography.caption, color: colors.textSecondary },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1 },
});
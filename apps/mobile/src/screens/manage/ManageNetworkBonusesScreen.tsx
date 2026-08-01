import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { formatCurrency } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';
import {
  getPendingNetworkBonuses,
  approveNetworkBonus,
  rejectNetworkBonus,
} from '../../services/api';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageNetworkBonuses'>;

export function ManageNetworkBonusesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getPendingNetworkBonuses()
      .then(setBonuses)
      .catch(() => Alert.alert('Error', 'Failed to load network bonuses'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await approveNetworkBonus(id);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await rejectNetworkBonus(id);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Network Bonuses" />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
      ) : bonuses.length === 0 ? (
        <Text style={styles.empty}>No pending network bonuses.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={bonuses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Text style={styles.name}>{item.profiles?.full_name ?? 'Unknown'}</Text>
              <Text style={styles.meta}>
                {item.profiles?.distributor_id} · {item.bonus_type} · {item.period}
              </Text>
              <Text style={styles.amount}>
                {formatCurrency(Number(item.amount_tzs), 'TZS')} ({Number(item.bonus_pv).toFixed(2)} PV)
              </Text>
              <View style={styles.actions}>
                <Button
                  loading={processingId === item.id}
                  onPress={() => handleApprove(item.id)}
                  style={styles.btn}
                  title="Approve"
                />
                <Button
                  loading={processingId === item.id}
                  onPress={() => handleReject(item.id)}
                  style={styles.btn}
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
  empty: { ...typography.body, color: colors.textSecondary, padding: spacing.xxl, textAlign: 'center' },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { gap: spacing.xs },
  name: { ...typography.body, fontWeight: '700', color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.h3, color: colors.primary, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { flex: 1 },
});

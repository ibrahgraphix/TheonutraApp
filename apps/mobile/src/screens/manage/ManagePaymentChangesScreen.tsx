import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { colors, spacing, typography } from '../../theme';
import {
  getPendingPaymentMethodChanges,
  approvePaymentMethodChange,
  rejectPaymentMethodChange,
} from '../../services/api';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManagePaymentChanges'>;

export function ManagePaymentChangesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getPendingPaymentMethodChanges()
      .then(setRequests)
      .catch(() => Alert.alert('Error', 'Failed to load payment change requests'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await approvePaymentMethodChange(id);
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
      await rejectPaymentMethodChange(id);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Payment Changes" />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
      ) : requests.length === 0 ? (
        <Text style={styles.empty}>No pending payment method changes.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Text style={styles.name}>{item.profiles?.full_name ?? 'Unknown'}</Text>
              <Text style={styles.meta}>{item.profiles?.distributor_id}</Text>
              <View style={styles.compare}>
                <View style={styles.col}>
                  <Text style={styles.colLabel}>Current</Text>
                  <Text style={styles.colValue}>{item.old_payment_method ?? '—'}</Text>
                  <Text style={styles.colValue}>{item.old_payment_full_name ?? '—'}</Text>
                  <Text style={styles.colValue}>{item.old_payment_account_number ?? '—'}</Text>
                </View>
                <Text style={styles.arrow}>→</Text>
                <View style={styles.col}>
                  <Text style={styles.colLabel}>Requested</Text>
                  <Text style={styles.colValue}>{item.new_payment_method}</Text>
                  <Text style={styles.colValue}>{item.new_payment_full_name}</Text>
                  <Text style={styles.colValue}>{item.new_payment_account_number}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Button
                  loading={processingId === item.id}
                  onPress={() => handleApprove(item.id)}
                  style={styles.btn}
                  title="Confirm"
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
  card: { gap: spacing.sm },
  name: { ...typography.body, fontWeight: '700', color: colors.text },
  meta: { ...typography.caption, color: colors.textSecondary },
  compare: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  col: { flex: 1, gap: 2 },
  colLabel: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  colValue: { ...typography.bodySmall, color: colors.text },
  arrow: { ...typography.h3, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { flex: 1 },
});

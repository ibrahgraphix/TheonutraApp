import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Badge, Button, Card, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { confirmPayment, getDistributorName, getPendingPayments } from '../../services/api';
import type { Payment } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'PendingPayments'>;

interface PaymentRow extends Payment {
  distributorName?: string;
}

export function PendingPaymentsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPendingPayments();
    const enriched = await Promise.all(
      data.map(async (p) => ({
        ...p,
        distributorName: await getDistributorName(p.distributorId),
      })),
    );
    setPayments(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = (payment: Payment) => {
    Alert.alert(
      'Confirm Payment',
      `Confirm ${formatCurrency(payment.amount, payment.currency)} from ${payment.method === 'bank_transfer' ? 'bank transfer' : 'mobile money'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setConfirmingId(payment.id);
            try {
              await confirmPayment(payment.id);
              await load();
            } catch {
              Alert.alert('Error', 'Could not confirm payment.');
            } finally {
              setConfirmingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Pending Payments" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : payments.length === 0 ? (
        <Text style={styles.empty}>No pending payments.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.distributorName}</Text>
                <Badge
                  label={item.method === 'bank_transfer' ? 'Bank' : 'Mobile'}
                  variant="secondary"
                />
              </View>
              <Text style={styles.amount}>
                {formatCurrency(item.amount, item.currency)}
              </Text>
              <Text style={styles.meta}>
                {item.method === 'bank_transfer'
                  ? `Ref: ${item.reference}`
                  : `${item.provider} · ${item.phone}`}
              </Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              <Button
                loading={confirmingId === item.id}
                onPress={() => handleConfirm(item)}
                style={styles.confirmBtn}
                title="Confirm Payment"
              />
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
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    padding: spacing.xxl,
    textAlign: 'center',
  },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...typography.label, color: colors.text },
  amount: { ...typography.h3, color: colors.primary },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  date: { ...typography.caption, color: colors.textSecondary },
  confirmBtn: { marginTop: spacing.sm },
});

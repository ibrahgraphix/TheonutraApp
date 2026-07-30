import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Badge, Button, Card, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import {
  confirmPayment,
  getAwaitingPaymentOrders,
  getDistributorName,
  getPendingPayments,
  markOrderPaidManually,
  type AwaitingPaymentOrder,
} from '../../services/api';
import type { Payment } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'PendingPayments'>;
type Tab = 'unconfirmed' | 'awaiting';

interface PaymentRow extends Payment {
  distributorName?: string;
}

export function PendingPaymentsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [tab, setTab] = useState<Tab>('unconfirmed');

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [awaitingOrders, setAwaitingOrders] = useState<AwaitingPaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadUnconfirmed = useCallback(async () => {
    const data = await getPendingPayments();
    const enriched = await Promise.all(
      data.map(async (p) => ({
        ...p,
        distributorName: (p as any).buyerName || (p.distributorId ? await getDistributorName(p.distributorId) : 'Unknown'),
      })),
    );
    setPayments(enriched);
  }, []);

  const loadAwaiting = useCallback(async () => {
    const data = await getAwaitingPaymentOrders();
    setAwaitingOrders(data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadUnconfirmed(), loadAwaiting()]);
    } finally {
      setLoading(false);
    }
  }, [loadUnconfirmed, loadAwaiting]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleConfirm = (payment: Payment) => {
    Alert.alert(
      'Confirm Payment',
      `Confirm ${formatCurrency(payment.amount, payment.currency)} from ${payment.method === 'bank_transfer' ? 'bank transfer' : 'mobile money'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setProcessingId(payment.id);
            try {
              await confirmPayment(payment.id);
              await loadUnconfirmed();
            } catch {
              Alert.alert('Error', 'Could not confirm payment.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const handleMarkPaid = (order: AwaitingPaymentOrder) => {
    Alert.alert(
      'Mark as Paid',
      `Mark ${formatCurrency(order.total, order.currency)} from ${order.buyerName ?? 'this distributor'} as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            setProcessingId(order.id);
            try {
              await markOrderPaidManually(order.id, 'cash');
              await loadAwaiting();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not mark order as paid.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Payments" />

      <View style={styles.tabs}>
        <TouchableOpacity
          onPress={() => setTab('unconfirmed')}
          style={[styles.tab, tab === 'unconfirmed' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'unconfirmed' && styles.tabTextActive]}>
            Unconfirmed ({payments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('awaiting')}
          style={[styles.tab, tab === 'awaiting' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'awaiting' && styles.tabTextActive]}>
            Awaiting Payment ({awaitingOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : tab === 'unconfirmed' ? (
        payments.length === 0 ? (
          <Text style={styles.empty}>No unconfirmed payments.</Text>
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
                  loading={processingId === item.id}
                  onPress={() => handleConfirm(item)}
                  style={styles.confirmBtn}
                  title="Confirm Payment"
                />
              </Card>
            )}
          />
        )
      ) : awaitingOrders.length === 0 ? (
        <Text style={styles.empty}>No orders awaiting payment.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={awaitingOrders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.buyerName}</Text>
                <Badge label="Pay Later" variant="secondary" />
              </View>
              <Text style={styles.amount}>
                {formatCurrency(item.total, item.currency)}
              </Text>
              <Text style={styles.meta}>
                {item.items?.length ?? 0} item{item.items?.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              <Button
                loading={processingId === item.id}
                onPress={() => handleMarkPaid(item)}
                style={styles.confirmBtn}
                title="Mark as Paid"
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
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...typography.bodySmall, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
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
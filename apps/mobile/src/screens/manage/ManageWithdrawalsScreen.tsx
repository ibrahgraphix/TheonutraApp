// ManageWithdrawalsScreen — Staff view: approve / reject / mark-paid withdrawal requests
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Badge, Button, Card, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import {
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
} from '../../services/api';
import type { WithdrawalRequest } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageWithdrawals'>;
type FilterTab = 'pending' | 'approved' | 'all';

const METHOD_LABEL: Record<string, string> = {
  bank: '🏦 Bank',
  mobile_money: '📱 Mobile Money',
};

const STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'error' | 'secondary'> = {
  pending: 'secondary',
  approved: 'neutral',
  paid: 'success',
  rejected: 'error',
};

export function ManageWithdrawalsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [tab, setTab] = useState<FilterTab>('pending');
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = tab === 'all' ? undefined : tab;
      const data = await getAllWithdrawals(status);
      setRequests(data);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load withdrawal requests.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = (req: WithdrawalRequest) => {
    Alert.alert(
      'Approve Withdrawal',
      `Approve ${formatCurrency(req.amount, 'USD')} for ${req.profiles?.full_name ?? req.distributor_id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessingId(req.id);
            try {
              await approveWithdrawal(req.id);
              await load();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const handleReject = (req: WithdrawalRequest) => {
    Alert.prompt(
      'Reject Withdrawal',
      'Enter rejection reason (visible to distributor):',
      async (notes) => {
        if (!notes?.trim()) {
          Alert.alert('Required', 'Please provide a rejection reason.');
          return;
        }
        setProcessingId(req.id);
        try {
          await rejectWithdrawal(req.id, notes.trim());
          await load();
        } catch (e) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to reject.');
        } finally {
          setProcessingId(null);
        }
      },
      'plain-text',
    );
  };

  const handleMarkPaid = (req: WithdrawalRequest) => {
    Alert.alert(
      'Mark as Paid',
      `Confirm you have transferred ${formatCurrency(req.amount, 'USD')} to ${req.profiles?.full_name ?? req.distributor_id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            setProcessingId(req.id);
            try {
              await markWithdrawalPaid(req.id);
              await load();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to mark as paid.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'all', label: 'All' },
  ];

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Withdrawals" />

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : requests.length === 0 ? (
        <Text style={styles.empty}>No {tab === 'all' ? '' : tab} withdrawal requests.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.nameBlock}>
                  <Text style={styles.name}>{item.profiles?.full_name ?? '—'}</Text>
                  <Text style={styles.distributorId}>{item.profiles?.distributor_id ?? item.distributor_id}</Text>
                </View>
                <Badge label={item.status} variant={STATUS_VARIANT[item.status] ?? 'neutral'} />
              </View>

              <Text style={styles.amount}>{formatCurrency(item.amount, 'USD')}</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{METHOD_LABEL[item.method] ?? item.method}</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{item.payout_details}</Text>
              </View>

              <Text style={styles.date}>{formatDate(item.created_at)}</Text>

              {item.notes ? (
                <Text style={styles.notes}>Note: {item.notes}</Text>
              ) : null}

              {/* Actions */}
              {item.status === 'pending' && (
                <View style={styles.actions}>
                  <Button
                    loading={processingId === item.id}
                    onPress={() => handleApprove(item)}
                    style={[styles.actionBtn, styles.approveBtn]}
                    title="Approve"
                  />
                  <Button
                    loading={processingId === item.id}
                    onPress={() => handleReject(item)}
                    style={styles.actionBtn}
                    title="Reject"
                    variant="outline"
                  />
                </View>
              )}

              {item.status === 'approved' && (
                <Button
                  loading={processingId === item.id}
                  onPress={() => handleMarkPaid(item)}
                  style={styles.markPaidBtn}
                  title="✅ Mark as Paid"
                />
              )}
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
  empty: { ...typography.body, color: colors.textSecondary, padding: spacing.xxl, textAlign: 'center' },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nameBlock: { flex: 1, gap: 2 },
  name: { ...typography.label, color: colors.text },
  distributorId: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.h3, color: colors.primary },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  infoLabel: { ...typography.caption, color: colors.textSecondary, width: 90 },
  infoValue: { ...typography.caption, color: colors.text, flex: 1 },
  date: { ...typography.caption, color: colors.textSecondary },
  notes: { ...typography.caption, color: colors.warning, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: { flex: 1 },
  approveBtn: {},
  markPaidBtn: { marginTop: spacing.xs },
});

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  ListItem,
  ShopHeader,
} from '../../components';
import {
  getMyWallet,
  getMyTransactions,
  getMyWithdrawals,
  requestWithdrawal,
  getMyKyc,
} from '../../services/api';
import type { WalletBalance, Transaction, WithdrawalRequest, WithdrawalMethod } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AccountStackParamList } from '../../navigation/accountTypes';
import { useAuthStore } from '../../store/authStore';

type Tab = 'overview' | 'transactions' | 'withdrawals';

// Backend has no per-wallet currency field yet — using a single default.
const DEFAULT_CURRENCY = 'USD';

// Per THEONUTRA Compensation Plan V1 §6 — mirror these if wallet_settings
// ever changes; a dedicated GET /api/wallet/settings endpoint would be the
// next step to make these live instead of hardcoded.
const MIN_WITHDRAWAL = 20000;
const WITHDRAWAL_FEE_PCT = 2;

export function WalletScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AccountStackParamList>>();

  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [kycVerified, setKycVerified] = useState<boolean | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawalMethod>('bank');
  const [payoutDetails, setPayoutDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isStaff = useAuthStore((s) => {
    const role = s.distributor?.role;
    return role === 'admin' || role === 'company_staff';
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, txData, wdData] = await Promise.all([
        getMyWallet(),
        getMyTransactions(1, 30),
        getMyWithdrawals(),
      ]);
      setWallet(w);
      setTransactions(txData.transactions);
      setWithdrawals(wdData);
      if (isStaff) {
        setKycVerified(true);
      } else {
        try {
          const kycData = await getMyKyc();
          setKycVerified(kycData.status === 'approved');
        } catch {
          setKycVerified(false);
        }
      }
    } catch {
      // keep partial state
    } finally {
      setLoading(false);
    }
  }, [isStaff]);

  useEffect(() => { void load(); }, [load]);

  const handleWithdraw = () => {
    if (!kycVerified) {
      Alert.alert(
        'KYC Required',
        'You must complete identity verification before requesting a withdrawal.',
        [
          { text: 'Verify Now', onPress: () => navigation.navigate('KycVerification') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    setShowWithdraw(true);
  };

  const parsedAmount = parseFloat(withdrawAmount) || 0;
  const feeAmount = parsedAmount * (WITHDRAWAL_FEE_PCT / 100);
  const netAmount = parsedAmount - feeAmount;

  const submitWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Enter a valid amount.');
      return;
    }
    if (amount < MIN_WITHDRAWAL) {
      Alert.alert('Error', `Minimum withdrawal is ${formatCurrency(MIN_WITHDRAWAL, DEFAULT_CURRENCY)}.`);
      return;
    }
    if (!payoutDetails.trim()) {
      Alert.alert('Error', 'Enter your payout details (account/phone number).');
      return;
    }
    setSubmitting(true);
    try {
      await requestWithdrawal(amount, withdrawMethod, payoutDetails.trim());
      setShowWithdraw(false);
      setWithdrawAmount('');
      setPayoutDetails('');
      await load();
      Alert.alert('Success', 'Withdrawal request submitted.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const txIcon = (type: string) => {
    if (type === 'credit') return '⬆️';
    if (type === 'debit') return '⬇️';
    return '🔄';
  };

  const statusVariant = (s: string): 'success' | 'neutral' | 'error' | 'secondary' => {
    if (s === 'approved' || s === 'paid') return 'success';
    if (s === 'rejected') return 'error';
    return 'neutral';
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
      <ShopHeader onBack={() => navigation.goBack()} title="Wallet" />

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>
          {wallet ? formatCurrency(wallet.balance, DEFAULT_CURRENCY) : '—'}
        </Text>
        <Button
          onPress={handleWithdraw}
          title="Request Withdrawal"
          style={styles.withdrawBtn}
        />
        {kycVerified === false && !isStaff ? (
          <TouchableOpacity onPress={() => navigation.navigate('KycVerification')}>
            <Text style={styles.kycWarning}>⚠️ Verify your identity to unlock withdrawals</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {(['overview', 'transactions', 'withdrawals'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'overview'
                ? 'Overview'
                : t === 'transactions'
                  ? 'Transactions'
                  : 'Withdrawals'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'overview' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Text style={styles.cardTitle}>Recent Transactions</Text>
            {transactions.slice(0, 5).map((tx) => (
              <ListItem
                key={tx.id}
                title={`${txIcon(tx.type)} ${tx.description ?? tx.type}`}
                subtitle={formatDate(tx.created_at)}
                right={
                  <Text
                    style={[
                      styles.txAmount,
                      tx.type === 'credit' ? styles.credit : styles.debit,
                    ]}
                  >
                    {tx.type === 'credit' ? '+' : '-'}
                    {formatCurrency(tx.amount, DEFAULT_CURRENCY)}
                  </Text>
                }
              />
            ))}
            {transactions.length === 0 ? (
              <Text style={styles.empty}>No transactions yet.</Text>
            ) : null}
          </Card>
        </ScrollView>
      )}

      {tab === 'transactions' && (
        <FlatList
          contentContainerStyle={styles.content}
          data={transactions}
          keyExtractor={(t) => t.id}
          ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
          renderItem={({ item: tx }) => (
            <ListItem
              key={tx.id}
              title={`${txIcon(tx.type)} ${tx.description ?? tx.type}`}
              subtitle={formatDate(tx.created_at)}
              right={
                <Text
                  style={[
                    styles.txAmount,
                    tx.type === 'credit' ? styles.credit : styles.debit,
                  ]}
                >
                  {tx.type === 'credit' ? '+' : '-'}
                  {formatCurrency(tx.amount, DEFAULT_CURRENCY)}
                </Text>
              }
            />
          )}
        />
      )}

      {tab === 'withdrawals' && (
        <FlatList
          contentContainerStyle={styles.content}
          data={withdrawals}
          keyExtractor={(w) => w.id}
          ListEmptyComponent={<Text style={styles.empty}>No withdrawal requests yet.</Text>}
          renderItem={({ item: wd }) => (
            <ListItem
              key={wd.id}
              title={formatCurrency(wd.amount, DEFAULT_CURRENCY)}
              subtitle={`${formatDate(wd.created_at)} · ${wd.method.replace('_', ' ')}`}
              right={<Badge label={wd.status} variant={statusVariant(wd.status)} />}
            />
          )}
        />
      )}

      <Modal animationType="slide" transparent visible={showWithdraw}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Withdrawal</Text>
            <Text style={styles.modalHint}>
              Minimum {formatCurrency(MIN_WITHDRAWAL, DEFAULT_CURRENCY)} · {WITHDRAWAL_FEE_PCT}% withdrawal fee applies
            </Text>
            <View style={styles.methodRow}>
              {(['bank', 'mobile_money'] as WithdrawalMethod[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setWithdrawMethod(m)}
                  style={[
                    styles.methodBtn,
                    withdrawMethod === m && styles.methodBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.methodBtnText,
                      withdrawMethod === m && styles.methodBtnTextActive,
                    ]}
                  >
                    {m === 'bank' ? '🏦 Bank' : '📱 Mobile Money'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              keyboardType="numeric"
              onChangeText={setWithdrawAmount}
              placeholder="Amount"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={withdrawAmount}
            />
            {parsedAmount > 0 ? (
              <View style={styles.feeBreakdown}>
                <Text style={styles.feeLine}>Fee ({WITHDRAWAL_FEE_PCT}%): {formatCurrency(feeAmount, DEFAULT_CURRENCY)}</Text>
                <Text style={styles.feeLineNet}>You'll receive: {formatCurrency(netAmount, DEFAULT_CURRENCY)}</Text>
              </View>
            ) : null}
            <TextInput
              onChangeText={setPayoutDetails}
              placeholder={
                withdrawMethod === 'bank'
                  ? 'Account number / bank name'
                  : 'Mobile money number (M-Pesa, Airtel Money, Mixx by Yas)'
              }
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={payoutDetails}
            />
            <Button
              fullWidth
              loading={submitting}
              onPress={submitWithdrawal}
              title="Submit Request"
            />
            <Button
              onPress={() => setShowWithdraw(false)}
              title="Cancel"
              variant="ghost"
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  balanceCard: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: '800' },
  withdrawBtn: { marginTop: spacing.sm },
  kycWarning: { color: '#fde047', fontSize: 12, marginTop: spacing.xs, textAlign: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...typography.bodySmall, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  content: { gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.xxxl },
  cardTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  txAmount: { ...typography.bodySmall, fontWeight: '700' },
  credit: { color: '#10b981' },
  debit: { color: colors.error },
  empty: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', padding: spacing.lg },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: spacing.md,
    padding: spacing.xxl,
  },
  modalTitle: { ...typography.h3, color: colors.text },
  modalHint: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.sm },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  methodBtn: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  methodBtnActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  methodBtnText: { ...typography.bodySmall, color: colors.textSecondary },
  methodBtnTextActive: { color: colors.primary, fontWeight: '700' },
  input: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    padding: spacing.md,
  },
  feeBreakdown: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    gap: 2,
    padding: spacing.sm,
  },
  feeLine: { ...typography.caption, color: colors.textSecondary },
  feeLineNet: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
});
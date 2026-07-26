import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmModal,
  Input,
  ListItem,
  MonthPicker,
  ShopHeader,
  SimpleBarChart,
} from '../../components';
import {
  changePassword,
  changePhone,
  deleteAccount,
  getAnalysisMonths,
  getMonthLabelForKey,
  getMonthlyAnalysis,
  getOrders,
  getMyRankProgress,
  getMyWallet,
  getNotificationUnreadCount,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { MonthlyAnalysis, Order, RankProgress, WalletBalance } from '../../types';
import { formatCurrency, formatDate, formatOrderStatus } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';
import type { AccountStackParamList } from '../../navigation/accountTypes';

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Required'),
    newPassword: z.string().min(6, 'At least 6 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

const phoneSchema = z.object({
  phone: z.string().min(9, 'Enter a valid phone number'),
});

// Backend has no per-wallet currency field yet — using a single default.
const DEFAULT_CURRENCY = 'USD';

// Rank ladder display
const RANK_COLORS: Record<string, string> = {
  Member: '#6b7280',
  Bronze: '#cd7f32',
  Silver: '#9ca3af',
  Gold: '#f59e0b',
  Platinum: '#06b6d4',
  Diamond: '#8b5cf6',
};

export function AccountScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const distributor = useAuthStore((s) => s.distributor);
  const logout = useAuthStore((s) => s.logout);
  const updateDistributor = useAuthStore((s) => s.updateDistributor);

  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [analysis, setAnalysis] = useState<MonthlyAnalysis | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [rankProgress, setRankProgress] = useState<RankProgress | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const [passwordModal, setPasswordModal] = useState(false);
  const [phoneModal, setPhoneModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: '', newPassword: '', confirm: '' },
  });

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: distributor?.phone ?? '' },
  });

  useEffect(() => {
    if (!distributor) return;
    Promise.all([
      getAnalysisMonths(distributor.id),
      getOrders(distributor.id),
      getMyRankProgress().catch(() => null),
      getMyWallet().catch(() => null),
      getNotificationUnreadCount().catch(() => ({ count: 0 })),
    ]).then(([m, o, rp, wb, uc]) => {
      setMonths(m);
      setSelectedMonth(m[0] ?? '');
      setOrders(o.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (rp) setRankProgress(rp);
      if (wb) setWallet(wb);
      setUnreadCount((uc as { count: number })?.count ?? 0);
      setLoading(false);
    });
  }, [distributor]);

  useEffect(() => {
    if (!distributor || !selectedMonth) return;
    getMonthlyAnalysis(distributor.id, selectedMonth).then(setAnalysis);
  }, [distributor, selectedMonth]);

  const monthLabels = Object.fromEntries(months.map((m) => [m, getMonthLabelForKey(m)]));

  const handlePasswordChange = passwordForm.handleSubmit(async (data) => {
    if (!distributor) return;
    setSubmitting(true);
    setSettingsError(null);
    try {
      await changePassword(distributor.id, data.current, data.newPassword);
      setPasswordModal(false);
      passwordForm.reset();
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  });

  const handlePhoneChange = phoneForm.handleSubmit(async (data) => {
    if (!distributor) return;
    setSubmitting(true);
    try {
      const updated = await changePhone(distributor.id, data.phone);
      updateDistributor(updated);
      setPhoneModal(false);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  });

  const handleDelete = async () => {
    if (!distributor) return;
    setSubmitting(true);
    try {
      await deleteAccount(distributor.id);
      setDeleteModal(false);
      logout();
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!distributor) return null;

  const rankColor = rankProgress?.currentRank
    ? (RANK_COLORS[rankProgress.currentRank.name] ?? colors.primary)
    : colors.primary;

  return (
    <View style={styles.container}>
      <ShopHeader title="Account" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <Card style={styles.profileCard}>
          <Avatar name={distributor.fullName} size={56} />
          <Text style={styles.name}>{distributor.fullName}</Text>
          <Badge label={distributor.distributorId} variant="secondary" />
          <Text style={styles.phone}>{distributor.phone}</Text>
        </Card>

        {/* Rank & PV card */}
        {rankProgress ? (
          <Card style={[styles.rankCard, { borderLeftColor: rankColor }]}>
            <View style={styles.rankHeader}>
              <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
                <Text style={styles.rankBadgeText}>
                  ⭐ {rankProgress.currentRank?.name ?? 'Member'}
                </Text>
              </View>
              {rankProgress.nextRank ? (
                <Text style={styles.rankNext}>→ {rankProgress.nextRank.name}</Text>
              ) : (
                <Text style={styles.rankNext}>🏆 Top Rank!</Text>
              )}
            </View>
            <View style={styles.pvRow}>
              <PvStat label="Personal PV" value={rankProgress.personalPV ?? 0} />
              <PvStat label="Team PV" value={rankProgress.teamPV ?? 0} />
              {rankProgress.nextRank ? (
                <PvStat label="PV to Next" value={Math.max(0, rankProgress.personalPVNeeded ?? 0)} />
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* Quick links row */}
        <View style={styles.quickLinks}>
          <QuickLink
            icon="💰"
            label={wallet ? formatCurrency(wallet.balance, DEFAULT_CURRENCY) : 'Wallet'}
            onPress={() => navigation.navigate('Wallet')}
          />
          <QuickLink
            badge={unreadCount}
            icon="🔔"
            label="Notifications"
            onPress={() => navigation.navigate('Notifications')}
          />
          <QuickLink
            icon="🎓"
            label="Training"
            onPress={() => navigation.navigate('TrainingAcademy')}
          />
          <QuickLink
            icon="📅"
            label="Events"
            onPress={() => navigation.navigate('Events')}
          />
        </View>
        <View style={styles.quickLinks}>
          <QuickLink
            icon="🔗"
            label="Referral"
            onPress={() => navigation.navigate('Referral')}
          />
          <QuickLink
            icon="⭐"
            label="Loyalty"
            onPress={() => navigation.navigate('Loyalty')}
          />
        </View>

        {/* Monthly Analysis */}
        <Text style={styles.sectionTitle}>Monthly Analysis</Text>
        {months.length > 0 ? (
          <MonthPicker
            labels={monthLabels}
            months={months}
            onSelect={setSelectedMonth}
            selected={selectedMonth}
          />
        ) : null}

        {loading || !analysis ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Card>
            <SimpleBarChart
              data={[
                { label: 'Personal', value: analysis.personalSales, color: colors.primary },
                { label: 'Team', value: analysis.teamSales, color: colors.secondary },
                { label: 'Bonus', value: analysis.bonusEarned, color: colors.primaryLight },
              ]}
              formatValue={(v) => formatCurrency(v, analysis.currency)}
            />
            <View style={styles.statsRow}>
              <Stat label="Personal" value={formatCurrency(analysis.personalSales, analysis.currency)} />
              <Stat label="Team" value={formatCurrency(analysis.teamSales, analysis.currency)} />
              <Stat label="Bonus" value={formatCurrency(analysis.bonusEarned, analysis.currency)} />
            </View>
          </Card>
        )}

        {/* Order History */}
        <Text style={styles.sectionTitle}>Order History</Text>
        {orders.length === 0 ? (
          <Text style={styles.empty}>No orders yet.</Text>
        ) : (
          orders.map((order) => (
            <ListItem
              key={order.id}
              right={
                <Badge
                  label={formatOrderStatus(order.status)}
                  variant={order.status === 'delivered' ? 'success' : 'neutral'}
                />
              }
              subtitle={`${formatDate(order.createdAt)} · ${order.items.length} item(s)`}
              title={formatCurrency(order.total, order.currency)}
            />
          ))
        )}

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <Card style={styles.settingsCard}>
          <SettingsRow label="Change Password" onPress={() => setPasswordModal(true)} />
          <SettingsRow label="Change Mobile Number" onPress={() => setPhoneModal(true)} />
          <SettingsRow
            destructive
            label="Delete Account"
            onPress={() => setDeleteModal(true)}
          />
          <Button onPress={logout} style={styles.logoutBtn} title="Sign Out" variant="outline" />
        </Card>
      </ScrollView>

      <FormModal onClose={() => setPasswordModal(false)} title="Change Password" visible={passwordModal}>
        <Controller
          control={passwordForm.control}
          name="current"
          render={({ field: { onChange, value } }) => (
            <Input
              error={passwordForm.formState.errors.current?.message}
              label="Current Password"
              onChangeText={onChange}
              secureTextEntry
              value={value}
            />
          )}
        />
        <Controller
          control={passwordForm.control}
          name="newPassword"
          render={({ field: { onChange, value } }) => (
            <Input
              error={passwordForm.formState.errors.newPassword?.message}
              label="New Password"
              onChangeText={onChange}
              secureTextEntry
              value={value}
            />
          )}
        />
        <Controller
          control={passwordForm.control}
          name="confirm"
          render={({ field: { onChange, value } }) => (
            <Input
              error={passwordForm.formState.errors.confirm?.message}
              label="Confirm Password"
              onChangeText={onChange}
              secureTextEntry
              value={value}
            />
          )}
        />
        {settingsError ? <Text style={styles.error}>{settingsError}</Text> : null}
        <Button fullWidth loading={submitting} onPress={handlePasswordChange} title="Save" />
      </FormModal>

      <FormModal onClose={() => setPhoneModal(false)} title="Change Mobile Number" visible={phoneModal}>
        <Controller
          control={phoneForm.control}
          name="phone"
          render={({ field: { onChange, value } }) => (
            <Input
              error={phoneForm.formState.errors.phone?.message}
              keyboardType="phone-pad"
              label="Phone Number"
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        <Button fullWidth loading={submitting} onPress={handlePhoneChange} title="Update" />
      </FormModal>

      <ConfirmModal
        confirmLabel="Delete Forever"
        destructive
        loading={submitting}
        message="This will permanently delete your distributor account, team data, and order history. This action cannot be undone."
        onCancel={() => setDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Account?"
        visible={deleteModal}
      />
    </View>
  );
}

function PvStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.pvStat}>
      <Text style={styles.pvStatValue}>{value.toLocaleString()}</Text>
      <Text style={styles.pvStatLabel}>{label}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.quickLink}>
      <View style={styles.quickLinkIconWrap}>
        <Text style={styles.quickLinkIcon}>{icon}</Text>
        {badge != null && badge > 0 ? (
          <View style={styles.qlBadge}>
            <Text style={styles.qlBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.quickLinkLabel} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SettingsRow({
  label,
  onPress,
  destructive,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <ListItem
      onPress={onPress}
      right={<Text style={styles.chevron}>›</Text>}
      subtitle={destructive ? 'This action is irreversible' : undefined}
      title={label}
    />
  );
}

function FormModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.modalBody}>{children}</View>
          <Button onPress={onClose} title="Cancel" variant="ghost" />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  profileCard: { alignItems: 'center', gap: spacing.sm },
  name: { ...typography.h2, color: colors.text },
  phone: { ...typography.bodySmall, color: colors.textSecondary },
  sectionTitle: { ...typography.h3, color: colors.text },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statValue: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  empty: { ...typography.bodySmall, color: colors.textSecondary },
  settingsCard: { gap: spacing.sm },
  logoutBtn: { marginTop: spacing.md },
  chevron: { color: colors.textSecondary, fontSize: 20 },
  error: { ...typography.bodySmall, color: colors.error },
  modalOverlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: spacing.md,
    padding: spacing.xxl,
  },
  modalTitle: { ...typography.h3, color: colors.text },
  modalBody: { gap: spacing.md },
  rankCard: {
    borderLeftWidth: 4,
    gap: spacing.md,
  },
  rankHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rankBadge: {
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rankBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rankNext: { ...typography.bodySmall, color: colors.textSecondary },
  pvRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pvStat: { alignItems: 'center', flex: 1 },
  pvStatValue: { ...typography.h3, color: colors.primary, fontWeight: '700' },
  pvStatLabel: { ...typography.caption, color: colors.textSecondary },
  quickLinks: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  quickLink: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  quickLinkIconWrap: { position: 'relative' },
  quickLinkIcon: { fontSize: 22 },
  quickLinkLabel: { ...typography.caption, color: colors.text, textAlign: 'center' },
  qlBadge: {
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: 7,
    height: 14,
    justifyContent: 'center',
    minWidth: 14,
    position: 'absolute',
    right: -6,
    top: -4,
  },
  qlBadgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
});
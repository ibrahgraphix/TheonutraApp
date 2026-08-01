import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import {
  Avatar,
  Badge,
  Button,
  Card,
  ListItem,
  MonthPicker,
  ShopHeader,
  SimpleBarChart,
} from '../../components';
import {
  getAnalysisMonths,
  getMonthLabelForKey,
  getMonthlyAnalysis,
  getOrders,
  getMyCompensationSnapshot,
  getMyWallet,
  getNotificationUnreadCount,
  type CompensationSnapshot,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { MonthlyAnalysis, Order, WalletBalance } from '../../types';
import { formatCurrency, formatDate, formatOrderStatus } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';
import type { AccountStackParamList } from '../../navigation/accountTypes';

// Backend has no per-wallet currency field yet — using a single default.
const DEFAULT_CURRENCY = 'USD';

// Star rank color ladder (THEONUTRA V1)
const RANK_COLORS: Record<string, string> = {
  'Star 1': '#6b7280',
  'Star 2': '#94a3b8',
  'Star 3': '#cd7f32',
  'Star 4': '#06b6d4',
  'Star 5': '#f59e0b',
  'Star 6': '#8b5cf6',
  'Lead Star 7': '#dc2626',
};

export function AccountScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const distributor = useAuthStore((s) => s.distributor);
  const logout = useAuthStore((s) => s.logout);
  const updateDistributor = useAuthStore((s) => s.updateDistributor);
  const isStaff = distributor?.role === 'admin' || distributor?.role === 'company_staff';
  const isAdmin = distributor?.role === 'admin';

  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [analysis, setAnalysis] = useState<MonthlyAnalysis | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [compensation, setCompensation] = useState<CompensationSnapshot | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!distributor) return;
    Promise.all([
      getAnalysisMonths(distributor.id),
      getOrders(distributor.id),
      isStaff ? Promise.resolve(null) : getMyCompensationSnapshot().catch(() => null),
      getMyWallet().catch(() => null),
      getNotificationUnreadCount().catch(() => ({ count: 0 })),
    ]).then(([m, o, comp, wb, uc]) => {
      setMonths(m);
      setSelectedMonth(m[0] ?? '');
      setOrders(o.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      if (comp) setCompensation(comp);
      if (wb) setWallet(wb);
      setUnreadCount((uc as { count: number })?.count ?? 0);
      setLoading(false);
    });
  }, [distributor, isStaff]);

  useEffect(() => {
    if (!distributor || !selectedMonth) return;
    getMonthlyAnalysis(distributor.id, selectedMonth).then(setAnalysis);
  }, [distributor, selectedMonth]);

  const monthLabels = Object.fromEntries(months.map((m) => [m, getMonthLabelForKey(m)]));

  if (!distributor) return null;

  const rankName = compensation?.currentRank?.name;
  const rankColor = rankName ? (RANK_COLORS[rankName] ?? colors.primary) : colors.primary;

  return (
    <View style={styles.container}>
      <ShopHeader title="Account" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <Card style={styles.profileCard}>
          <Avatar
            imageUrl={distributor.avatarUrl}
            name={distributor.fullName}
            size={56}
          />
          <Text style={styles.name}>{distributor.fullName}</Text>
          <Badge label={distributor.distributorId} variant="secondary" />
          <Text style={styles.phone}>{distributor.phone}</Text>
        </Card>

        {/* THEONUTRA V1 — Rank / PPV / CGV / Legs */}
        {!isStaff && compensation ? (
          <Card style={[styles.rankCard, { borderLeftColor: rankColor }]}>
            <View style={styles.rankHeader}>
              <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
                <Text style={styles.rankBadgeText}>
                  ⭐ {compensation.currentRank?.name ?? 'Unranked'}
                  {compensation.isActive ? '' : ' · Inactive'}
                </Text>
              </View>
              <Text style={styles.rankNext}>
                {compensation.currentRank
                  ? `${compensation.currentRank.bonus_percent}% Active Bonus`
                  : ''}
              </Text>
            </View>
            <View style={styles.pvRow}>
              <PvStat
                label="PPV"
                value={`${Math.round(compensation.ppv)} / ${Math.round(compensation.ppvRequired)}`}
              />
              <PvStat label="GPV" value={Math.round(compensation.gpv)} />
              <PvStat label="CGV" value={Math.round(compensation.lifetimeCgv)} />
            </View>
            {compensation.nextRank ? (
              <Text style={styles.rankHint}>
                Need {Math.ceil(compensation.cgvNeeded)} CGV more to reach {compensation.nextRank.name}
                {compensation.ppvNeeded > 0
                  ? ` · ${Math.ceil(compensation.ppvNeeded)} PPV for active status`
                  : ''}
              </Text>
            ) : (
              <Text style={styles.rankHint}>
                PPV = personal this month · GPV = team this month · CGV = lifetime cumulative
              </Text>
            )}
            <View style={styles.legsRow}>
              <PvStat label="Left" value={Math.round(compensation.legs.left.ppv)} />
              <PvStat label="Center" value={Math.round(compensation.legs.center.ppv)} />
              <PvStat label="Right" value={Math.round(compensation.legs.right.ppv)} />
            </View>
          </Card>
        ) : null}

        {/* Quick links row */}
        <View style={styles.quickLinks}>
          <QuickLink
            icon="💰"
            label={wallet ? formatCurrency(wallet.balance, wallet.currency || DEFAULT_CURRENCY) : 'Wallet'}
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
          {!isStaff ? (
            <QuickLink
              icon="⭐"
              label="Loyalty"
              onPress={() => navigation.navigate('Loyalty')}
            />
          ) : null}
          {!isStaff ? (
            <QuickLink
              icon="🛒"
              label="Customer Sales"
              onPress={() => navigation.navigate('CustomerSales')}
            />
          ) : null}
        </View>

        {/* Monthly Analysis */}
        {!isAdmin && (
          <>
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
          </>
        )}

        {/* Order History */}
        {!isAdmin && (
          <>
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
          </>
        )}

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <Card style={styles.settingsCard}>
          <SettingsRow label="Account Settings" onPress={() => navigation.navigate('Settings')} />
          <Button onPress={logout} style={styles.logoutBtn} title="Sign Out" variant="outline" />
        </Card>
      </ScrollView>
    </View>
  );
}

function PvStat({ label, value }: { label: string; value: number | string }) {
  const display = typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <View style={styles.pvStat}>
      <Text style={styles.pvStatValue}>{display}</Text>
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
  rankHint: { ...typography.caption, color: colors.textSecondary },
  pvRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
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
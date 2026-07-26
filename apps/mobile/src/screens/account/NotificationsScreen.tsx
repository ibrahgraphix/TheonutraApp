import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ShopHeader } from '../../components';
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/api';
import type { Notification } from '../../types';
import { colors, spacing, typography } from '../../theme';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {
      // silently ignore
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // silently ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'commission_earned': return '💰';
      case 'team_bonus_earned': return '👥';
      case 'withdrawal_status': return '🏦';
      case 'kyc_status': return '🪪';
      case 'new_referral': return '🔗';
      case 'manual_bonus': return '🎁';
      default: return '🔔';
    }
  };

  const hasUnread = Array.isArray(notifications) && notifications.some((n) => !n.is_read);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={() => navigation.goBack()}
        title="Notifications"
        rightElement={
          hasUnread ? (
            <TouchableOpacity onPress={handleMarkAllRead} disabled={markingAll}>
              <Text style={styles.markAllBtn}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <FlatList
        contentContainerStyle={styles.content}
        data={notifications}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.empty}>You're all caught up!</Text>
          </View>
        }
        renderItem={({ item: notif }) => (
          <TouchableOpacity
            onPress={() => { if (!notif.is_read) void handleMarkRead(notif.id); }}
            style={[styles.notifItem, !notif.is_read && styles.notifItemUnread]}
          >
            <View style={styles.notifIconWrap}>
              <Text style={styles.notifIcon}>{typeIcon(notif.type)}</Text>
              {!notif.is_read ? <View style={styles.unreadDot} /> : null}
            </View>
            <View style={styles.notifBody}>
              <Text style={styles.notifTitle}>{notif.title}</Text>
              <Text style={styles.notifMessage}>{notif.message}</Text>
              <Text style={styles.notifTime}>
                {new Date(notif.created_at).toLocaleString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.xs, padding: spacing.md, paddingBottom: spacing.xxxl },
  markAllBtn: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  notifItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  notifItemUnread: {
    backgroundColor: `${colors.primary}0f`,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notifIconWrap: { position: 'relative' },
  notifIcon: { fontSize: 24 },
  unreadDot: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    height: 8,
    position: 'absolute',
    right: -2,
    top: -2,
    width: 8,
  },
  notifBody: { flex: 1, gap: spacing.xs },
  notifTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  notifMessage: { ...typography.bodySmall, color: colors.textSecondary },
  notifTime: { ...typography.caption, color: colors.textSecondary },
  emptyWrap: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  empty: { ...typography.body, color: colors.textSecondary },
});
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Badge, ShopHeader } from '../../components';
import { listUpcomingEvents, listPastEvents } from '../../services/api';
import type { Event } from '../../types';
import { colors, spacing, typography } from '../../theme';

type Tab = 'upcoming' | 'past';

const TYPE_LABELS: Record<string, string> = {
  general: '📅 General',
  health_education: '🩺 Health Education',
  training: '🎓 Training',
  product_launch: '🚀 Product Launch',
};

export function EventsScreen() {
  const navigation = useNavigation();
  const [upcoming, setUpcoming] = useState<Event[]>([]);
  const [past, setPast] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([listUpcomingEvents(), listPastEvents()]);
      setUpcoming(u);
      setPast(p);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const data = tab === 'upcoming' ? upcoming : past;

  const openLink = async (url: string) => {
    const ok = await Linking.canOpenURL(url);
    if (ok) void Linking.openURL(url);
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
      <ShopHeader onBack={() => navigation.goBack()} title="Events" />

      {/* Tab switcher */}
      <View style={styles.tabs}>
        {(['upcoming', 'past'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'upcoming' ? '📅 Upcoming' : '🕰 Past'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(e) => e.id}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.empty}>
              {tab === 'upcoming' ? 'No upcoming events.' : 'No past events.'}
            </Text>
          </View>
        }
        renderItem={({ item: event }) => {
          const startDate = new Date(event.start_at);
          const endDate = new Date(event.end_at);
          const isOnline = event.is_online;

          return (
            <View style={styles.eventCard}>
              {/* Date strip */}
              <View style={styles.dateStrip}>
                <Text style={styles.dateMonth}>
                  {startDate.toLocaleString('default', { month: 'short' }).toUpperCase()}
                </Text>
                <Text style={styles.dateDay}>{startDate.getDate()}</Text>
              </View>

              {/* Content */}
              <View style={styles.eventContent}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventType}>
                    {TYPE_LABELS[event.event_type] ?? '📅 Event'}
                  </Text>
                  {isOnline ? (
                    <Badge label="Virtual" variant="secondary" />
                  ) : null}
                </View>
                <Text style={styles.eventTitle}>{event.title}</Text>
                {event.description ? (
                  <Text style={styles.eventDesc} numberOfLines={2}>
                    {event.description}
                  </Text>
                ) : null}
                <Text style={styles.eventTime}>
                  {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {event.location ? (
                  <Text style={styles.eventLocation}>📍 {event.location}</Text>
                ) : null}
                {isOnline && event.meeting_note ? (
                  <TouchableOpacity onPress={() => void openLink(event.meeting_note!)}>
                    <Text style={styles.virtualLink}>🔗 Join Online →</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...typography.bodySmall, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dateStrip: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
    padding: spacing.md,
    width: 60,
  },
  dateMonth: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700' },
  dateDay: { color: '#fff', fontSize: 24, fontWeight: '800' },
  eventContent: { flex: 1, gap: spacing.xs, padding: spacing.md },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventType: { ...typography.caption, color: colors.textSecondary },
  eventTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  eventDesc: { ...typography.bodySmall, color: colors.textSecondary },
  eventTime: { ...typography.caption, color: colors.textSecondary },
  eventLocation: { ...typography.caption, color: colors.textSecondary },
  virtualLink: { ...typography.caption, color: colors.primary, fontWeight: '700', marginTop: spacing.xs },
  emptyWrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  emptyIcon: { fontSize: 48 },
  empty: { ...typography.body, color: colors.textSecondary },
});
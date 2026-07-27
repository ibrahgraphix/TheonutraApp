import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { deactivateEvent, hardDeleteEvent, listPastEvents, listUpcomingEvents } from '../../services/api';
import type { Event } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageEvents'>;

export function ManageEventsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [upcoming, past] = await Promise.all([listUpcomingEvents(), listPastEvents()]);
      const merged = [...upcoming, ...past].sort(
        (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
      );
      setEvents(merged);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleDeactivate = (event: Event) => {
    Alert.alert('Deactivate Event?', `Hide "${event.title}" from distributors?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await deactivateEvent(event.id);
            load();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to deactivate.');
          }
        },
      },
    ]);
  };

  const handleDelete = (event: Event) => {
    Alert.alert(
      'Delete Event?',
      `Permanently delete "${event.title}"? This also removes its banner image from Cloudinary and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(event.id);
            try {
              await hardDeleteEvent(event.id);
              load();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete event.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={() => navigation.navigate('AddEditEvent', {})} style={styles.headerAction}>
            <Text style={styles.headerActionText}>+ Add</Text>
          </Pressable>
        }
        title="Events"
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : events.length === 0 ? (
        <Text style={styles.empty}>No events yet. Tap + Add to create one.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{item.title}</Text>
                  {!item.is_active ? <Badge label="Inactive" variant="error" /> : null}
                </View>
                <Text style={styles.meta}>
                  {item.event_type.replace('_', ' ')} · {new Date(item.start_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => navigation.navigate('AddEditEvent', { eventId: item.id })}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                {item.is_active ? (
                  <Pressable onPress={() => handleDeactivate(item)} style={styles.actionBtn}>
                    <Text style={styles.deactivateText}>Deactivate</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  disabled={deletingId === item.id}
                  onPress={() => handleDelete(item)}
                  style={styles.actionBtn}
                >
                  <Text style={styles.deleteText}>
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  empty: { ...typography.body, color: colors.textSecondary, padding: spacing.xxl, textAlign: 'center' },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardBody: { gap: spacing.xs },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { ...typography.body, color: colors.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textSecondary },
  actionRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  actionBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  actionText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  deactivateText: { ...typography.caption, color: colors.warning ?? '#f59e0b', fontWeight: '600' },
  deleteText: { ...typography.caption, color: colors.error, fontWeight: '600' },
  headerAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  headerActionText: { ...typography.label, color: colors.textOnPrimary },
});
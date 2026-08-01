import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar, Badge, ConfirmModal, ListItem, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { activateSeller, deactivateSeller, hardDeleteSeller, searchDistributors } from '../../services/api';
import type { Distributor } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'DistributorList'>;
type ConfirmAction = { type: 'activate' | 'deactivate' | 'delete'; distributor: Distributor } | null;

export function DistributorListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [query, setQuery] = useState('');
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const data = await searchDistributors(q);
    setDistributors(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(query), 300);
    return () => clearTimeout(timer);
  }, [query, load]);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction.type === 'activate') {
        await activateSeller(confirmAction.distributor.id);
      } else if (confirmAction.type === 'deactivate') {
        await deactivateSeller(confirmAction.distributor.id);
      } else {
        await hardDeleteSeller(confirmAction.distributor.id);
      }
      setConfirmAction(null);
      await load(query);
    } catch (err) {
      Alert.alert(
        confirmAction.type === 'delete' ? 'Cannot delete' : 'Action failed',
        err instanceof Error ? err.message : 'Action failed.',
      );
    } finally {
      setProcessing(false);
    }
  };

  const confirmCopy = (() => {
    if (!confirmAction) return { title: '', message: '', confirmLabel: '' };
    if (confirmAction.type === 'activate') {
      return {
        title: 'Activate Distributor?',
        message: `Reactivate ${confirmAction.distributor.fullName}? They will be able to log in again.`,
        confirmLabel: 'Activate',
      };
    }
    if (confirmAction.type === 'deactivate') {
      return {
        title: 'Deactivate Distributor?',
        message: `Deactivate ${confirmAction.distributor.fullName}? They'll be blocked from logging in, but history stays intact.`,
        confirmLabel: 'Deactivate',
      };
    }
    return {
      title: 'Delete Distributor?',
      message: `Permanently delete ${confirmAction.distributor.fullName}? Only works if they have no downline, orders, or commissions.`,
      confirmLabel: 'Delete Forever',
    };
  })();

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={() => navigation.navigate('AddSeller')} style={styles.headerAction}>
            <Text style={styles.headerActionText}>+ Add</Text>
          </Pressable>
        }
        title="All Distributors"
      />

      <View style={styles.searchWrap}>
        <TextInput
          onChangeText={setQuery}
          placeholder="Search by name or distributor ID..."
          placeholderTextColor={colors.textSecondary}
          style={styles.search}
          value={query}
        />
        <Text style={styles.count}>
          {loading ? 'Loading…' : `${distributors.length} seller${distributors.length !== 1 ? 's' : ''}`}
        </Text>
        <Text style={styles.hint}>Tap a distributor to view their chain</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : distributors.length === 0 ? (
        <Text style={styles.empty}>No distributors match your search.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={distributors}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListItem
              left={<Avatar name={item.fullName} size={40} />}
              left={<Avatar imageUrl={item.avatarUrl} name={item.fullName} size={40} />}
              onPress={() =>
                navigation.navigate('DistributorDetail', {
                  distributorId: item.id,
                  distributorName: item.fullName,
                })
              }
              right={
                <View style={styles.itemActions}>
                  <View style={styles.badgeRow}>
                    <Badge label={item.role.replace('_', ' ')} variant="neutral" />
                    {item.isActive === false ? <Badge label="Inactive" variant="error" /> : null}
                  </View>
                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => navigation.navigate('EditSeller', { distributorId: item.id })}
                      style={styles.actionBtn}
                    >
                      <Text style={styles.actionText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('ResetPassword', {
                          distributorId: item.id,
                          distributorName: item.fullName,
                        })
                      }
                      style={styles.actionBtn}
                    >
                      <Text style={styles.actionText}>Reset</Text>
                    </Pressable>
                    {item.isActive === false ? (
                      <Pressable
                        onPress={() => setConfirmAction({ type: 'activate', distributor: item })}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.activateText}>Activate</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => setConfirmAction({ type: 'deactivate', distributor: item })}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.deactivateText}>Deactivate</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setConfirmAction({ type: 'delete', distributor: item })}
                      style={styles.actionBtn}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              }
              subtitle={`${item.distributorId} · ${item.country}`}
              title={item.fullName}
            />
          )}
        />
      )}

      <ConfirmModal
        confirmLabel={confirmCopy.confirmLabel}
        destructive={confirmAction?.type !== 'activate'}
        loading={processing}
        message={confirmCopy.message}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmCopy.title}
        visible={confirmAction !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  search: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  count: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  loader: { marginTop: spacing.xl },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    padding: spacing.xxl,
    textAlign: 'center',
  },
  list: { gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.xxxl },
  headerAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  headerActionText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
  itemActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtn: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.caption,
    color: colors.primary,
  },
  deactivateText: {
    ...typography.caption,
    color: colors.error,
  },
  activateText: {
    ...typography.caption,
    color: colors.success,
  },
  deleteText: {
    ...typography.caption,
    color: colors.error,
  },
});
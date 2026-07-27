import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, ConfirmModal, ListItem, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { activateCountry, deactivateCountry, getCountries, listCountriesForAdmin } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { Country } from '../../types';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'CountryList'>;
type ConfirmAction = { type: 'activate' | 'deactivate'; country: Country } | null;

export function CountryListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isStaff = useAuthStore((s) => {
    const role = s.distributor?.role;
    return role === 'admin' || role === 'company_staff';
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = isStaff ? await listCountriesForAdmin() : await getCountries();
      setCountries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load countries');
    } finally {
      setLoading(false);
    }
  }, [isStaff]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction.type === 'activate') {
        await activateCountry(confirmAction.country.id);
      } else {
        await deactivateCountry(confirmAction.country.id);
      }
      setConfirmAction(null);
      await load();
    } catch (err) {
      Alert.alert(
        confirmAction.type === 'activate' ? 'Cannot activate' : 'Cannot deactivate',
        err instanceof Error ? err.message : 'Action failed.',
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={() => navigation.goBack()}
        rightAction={
          isStaff ? (
            <Pressable onPress={() => navigation.navigate('AddCountry')} style={styles.headerAction}>
              <Text style={styles.headerActionText}>+ Add</Text>
            </Pressable>
          ) : undefined
        }
        title="Countries"
      />

      <View style={styles.meta}>
        <Text style={styles.count}>
          {loading
            ? 'Loading…'
            : `${countries.length} countr${countries.length === 1 ? 'y' : 'ies'}`}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : error ? (
        <Text style={styles.empty}>{error}</Text>
      ) : countries.length === 0 ? (
        <Text style={styles.empty}>
          {isStaff
            ? 'No countries yet. Tap + Add to create one.'
            : 'No countries yet. Ask an admin to add a country.'}
        </Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={countries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListItem
              onPress={isStaff ? () => navigation.navigate('EditCountry', { countryId: item.id }) : undefined}
              right={
                isStaff ? (
                  <View style={styles.itemActions}>
                    {!item.isActive ? <Badge label="Inactive" variant="error" /> : null}
                    <Pressable
                      onPress={() => navigation.navigate('EditCountry', { countryId: item.id })}
                      style={styles.actionBtn}
                    >
                      <Text style={styles.actionText}>Edit</Text>
                    </Pressable>
                    {item.isActive ? (
                      <Pressable
                        onPress={() => setConfirmAction({ type: 'deactivate', country: item })}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.deactivateText}>Deactivate</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => setConfirmAction({ type: 'activate', country: item })}
                        style={styles.actionBtn}
                      >
                        <Text style={styles.activateText}>Activate</Text>
                      </Pressable>
                    )}
                  </View>
                ) : undefined
              }
              subtitle={`${item.isoCode} · ${item.currencyCode}`}
              title={item.name}
            />
          )}
        />
      )}

      <ConfirmModal
        confirmLabel={confirmAction?.type === 'activate' ? 'Activate' : 'Deactivate'}
        destructive={confirmAction?.type === 'deactivate'}
        loading={processing}
        message={
          confirmAction?.type === 'activate'
            ? `Reactivate ${confirmAction.country.name}? It will become available again for distributors and products.`
            : `Deactivate ${confirmAction?.country.name}? Blocked if any distributor or product still references it.`
        }
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction?.type === 'activate' ? 'Activate Country?' : 'Deactivate Country?'}
        visible={confirmAction !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  meta: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  count: { ...typography.caption, color: colors.textSecondary },
  loader: { marginTop: spacing.xl },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    padding: spacing.xxl,
    textAlign: 'center',
  },
  list: { gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.xxxl },
  headerAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerActionText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
  itemActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  actionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  deactivateText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
  activateText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
});
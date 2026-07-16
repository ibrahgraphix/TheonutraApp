//CountryListScreen
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ListItem, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { getCountries } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { Country } from '../../types';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'CountryList'>;

export function CountryListScreen() {
  const navigation = useNavigation<NavigationProp>();
  // Match the staff check used everywhere else in the app (backend's
  // requireStaff middleware, MainNavigator's Manage tab) — both 'admin'
  // and 'company_staff' count as staff. Narrowing to 'admin' only here
  // was why the + Add button silently never showed for company_staff logins.
  const isStaff = useAuthStore((s) => {
    const role = s.distributor?.role;
    return role === 'admin' || role === 'company_staff';
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCountries();
      setCountries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load countries');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
              subtitle={`${item.isoCode} · ${item.currencyCode}`}
              title={item.name}
            />
          )}
        />
      )}
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
});
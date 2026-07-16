import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Badge, ListItem, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { searchDistributors } from '../../services/api';
import type { Distributor } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'DistributorList'>;

export function DistributorListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [query, setQuery] = useState('');
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);

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
              onPress={() =>
                navigation.navigate('DistributorDetail', {
                  distributorId: item.id,
                  distributorName: item.fullName,
                })
              }
              right={
                <View style={styles.itemActions}>
                  <Badge label={item.role.replace('_', ' ')} variant="neutral" />
                  <Pressable
                    onPress={() =>
                      navigation.navigate('ResetPassword', {
                        distributorId: item.id,
                        distributorName: item.fullName,
                      })
                    }
                    style={styles.resetAction}
                  >
                    <Text style={styles.resetActionText}>Reset</Text>
                  </Pressable>
                </View>
              }
              subtitle={`${item.distributorId} · ${item.country}`}
              title={item.fullName}
            />
          )}
        />
      )}
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
    gap: spacing.sm,
  },
  resetAction: {
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  resetActionText: {
    ...typography.caption,
    color: colors.primary,
  },
});
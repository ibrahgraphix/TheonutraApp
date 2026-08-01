import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { formatCurrency } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

import { getPendingCommissions, approveCommission, rejectCommission } from '../../services/api';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageCommissions'>;

export function ManageCommissionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getPendingCommissions()
      .then(setCommissions)
      .catch((err) => {
        console.error('Failed to load pending commissions:', err);
        Alert.alert('Error', 'Failed to load pending commissions');
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await approveCommission(id);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to approve.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await rejectCommission(id);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject.');
    } finally {
      setProcessingId(null);
    }
  };

  const getBonusTypeLabel = (bonusType: string) => {
    switch (bonusType) {
      case 'referral':
        return 'Referral Commission';
      case 'team_bonus':
        return 'Team Bonus';
      case 'opb':
        return 'OPB Bonus';
      case 'leadership':
        return 'Leadership Bonus';
      case 'rank':
        return 'Rank Bonus';
      default:
        return bonusType;
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Pending Commissions" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : commissions.length === 0 ? (
        <Text style={styles.empty}>No pending commissions.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={commissions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Text style={styles.name}>{item.profiles?.full_name ?? 'Unknown'}</Text>
              <Text style={styles.meta}>{item.profiles?.distributor_id ?? 'N/A'}</Text>
              <Text style={styles.type}>{getBonusTypeLabel(item.bonus_type || 'referral')}</Text>
              <Text style={styles.amount}>
                {formatCurrency(Number(item.amount), item.currencyCode || 'TZS')}
              </Text>
              {item.level && (
                <Text style={styles.detail}>Level {item.level}</Text>
              )}
              <Text style={styles.date}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
              </Text>
              <View style={styles.actionsRow}>
                <Button
                  loading={processingId === item.id}
                  onPress={() => handleApprove(item.id)}
                  style={styles.actionBtn}
                  title="Approve"
                />
                <Button
                  loading={processingId === item.id}
                  onPress={() => handleReject(item.id)}
                  style={styles.actionBtn}
                  title="Reject"
                  variant="outline"
                />
              </View>
            </Card>
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
  card: { gap: spacing.xs },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textSecondary },
  type: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  amount: { ...typography.h3, color: colors.primary, marginTop: spacing.xs },
  detail: { ...typography.caption, color: colors.textSecondary },
  date: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1 },
});

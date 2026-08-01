import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { Button, Card, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { colors, spacing, typography } from '../../theme';
import {
  runMonthlyCompensationJob,
  runPayoutBatch,
} from '../../services/api';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'SystemJobs'>;

function currentPeriod() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function SystemJobsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(false);
  const [monthlyResult, setMonthlyResult] = useState<any>(null);
  const [payoutResult, setPayoutResult] = useState<any>(null);

  const runMonthlyJob = async () => {
    setLoading(true);
    try {
      const period = currentPeriod();
      const result = await runMonthlyCompensationJob(period);
      setMonthlyResult(result);
      Alert.alert(
        'Monthly Job Complete',
        `Processed ${result.processed}, promoted ${result.promoted}, bonuses ${result.bonusesCreated}`,
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to run monthly job');
    } finally {
      setLoading(false);
    }
  };

  const runPayout = async () => {
    setLoading(true);
    try {
      const period = currentPeriod();
      const result = await runPayoutBatch(period);
      setPayoutResult(result);
      Alert.alert(
        'Payout Batch Complete',
        `Paid ${result.paidCount} · Total TZS ${result.totalTzs} · Skipped ${result.skipped}`,
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to run payout batch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="System Jobs" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Text style={styles.title}>V1 Monthly Compensation</Text>
          <Text style={styles.description}>
            Recalculates PPV/GPV, updates lifetime CGV, promotes Star ranks, and creates pending
            Active Monthly + Differential bonuses (PV → USD → TZS).
          </Text>
          <Button loading={loading} onPress={runMonthlyJob} style={styles.button} title="Run Monthly Job" />
          {monthlyResult ? (
            <Text style={styles.resultText}>
              Processed {monthlyResult.processed} · Promoted {monthlyResult.promoted} · Bonuses{' '}
              {monthlyResult.bonusesCreated}
            </Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>Monthly Payout Batch</Text>
          <Text style={styles.description}>
            Marks approved network bonuses as paid using each distributor&apos;s confirmed payment
            number. Approve bonuses first under Network Bonuses.
          </Text>
          <Button loading={loading} onPress={runPayout} style={styles.button} title="Run Payout Batch" />
          {payoutResult ? (
            <Text style={styles.resultText}>
              Paid {payoutResult.paidCount} · TZS {payoutResult.totalTzs} · Skipped {payoutResult.skipped}
            </Text>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { gap: spacing.md },
  title: { ...typography.h3, color: colors.text },
  description: { ...typography.bodySmall, color: colors.textSecondary },
  button: { marginTop: spacing.sm },
  resultText: { ...typography.caption, color: colors.primary },
});

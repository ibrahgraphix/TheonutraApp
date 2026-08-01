import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { Button, Card, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageHome'>;

export function SystemJobsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(false);
  const [dailyResult, setDailyResult] = useState<any>(null);
  const [monthlyResult, setMonthlyResult] = useState<any>(null);

  const runDailyJob = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/compensation/run-daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      setDailyResult(result);
      Alert.alert('✅ Daily Job Complete', `Processed ${result.processed} distributors`);
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to run daily job');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const runMonthlyJob = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      
      const response = await fetch('http://localhost:3001/api/compensation/run-monthly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ period }),
      });
      const result = await response.json();
      setMonthlyResult(result);
      Alert.alert('✅ Monthly Job Complete', `Processed ${result.processed} distributors, ${result.opbGenerated} OPB bonuses generated`);
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to run monthly job');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="System Jobs" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Text style={styles.title}>Daily PPV/CGV Calculation</Text>
          <Text style={styles.description}>
            Calculates Personal Point Value and Combined Group Volume for all distributors.
            Runs automatically every day in production.
          </Text>
          <Button
            loading={loading}
            onPress={runDailyJob}
            style={styles.button}
            title="Run Daily Job"
          />
          {dailyResult && (
            <View style={styles.result}>
              <Text style={styles.resultText}>
                ✅ Processed: {dailyResult.processed} distributors
              </Text>
              <Text style={styles.resultText}>
                🕐 Timestamp: {new Date(dailyResult.timestamp).toLocaleString()}
              </Text>
            </View>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>Monthly Requalification</Text>
          <Text style={styles.description}>
            Calculates all bonuses (OPB, Leadership, etc.) and sets them to "pending" status.
            Staff must approve pending bonuses before they reach distributor wallets.
            Runs automatically on the 1st of each month in production.
          </Text>
          <Button
            loading={loading}
            onPress={runMonthlyJob}
            style={styles.button}
            title="Run Monthly Job"
          />
          {monthlyResult && (
            <View style={styles.result}>
              <Text style={styles.resultText}>
                ✅ Processed: {monthlyResult.processed} distributors
              </Text>
              <Text style={styles.resultText}>
                📊 OPB Generated: {monthlyResult.opbGenerated} bonuses
              </Text>
              <Text style={styles.resultText}>
                ⬇️ Demoted: {monthlyResult.demoted} distributors
              </Text>
            </View>
          )}
        </Card>

        <Card style={[styles.card, styles.infoCard]}>
          <Text style={styles.infoTitle}>📋 For Client Demo</Text>
          <Text style={styles.infoText}>
            1. Use these buttons to trigger jobs manually for demonstration
          </Text>
          <Text style={styles.infoText}>
            2. Check OPB screen in Manage tab to see pending bonuses
          </Text>
          <Text style={styles.infoText}>
            3. Approve pending bonuses to see wallet credits
          </Text>
          <Text style={styles.infoText}>
            4. In production, these run automatically on schedule
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { marginBottom: spacing.lg, gap: spacing.md },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  button: { marginTop: spacing.sm },
  result: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.backgroundLight, borderRadius: spacing.sm },
  resultText: { ...typography.caption, color: colors.text, marginBottom: spacing.xs },
  infoCard: { backgroundColor: colors.primaryLight },
  infoTitle: { ...typography.h4, color: colors.primary, marginBottom: spacing.sm },
  infoText: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
});
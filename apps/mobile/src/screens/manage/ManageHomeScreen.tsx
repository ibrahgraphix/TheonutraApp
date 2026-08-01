import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, ShopHeader, ShortcutButton } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageHome'>;

export function ManageHomeScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <ShopHeader title="Manage" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Company admin dashboard</Text>

        <View style={styles.grid}>
          <ShortcutButton
            icon="👥"
            label="Distributors"
            onPress={() => navigation.navigate('DistributorList')}
          />
          <ShortcutButton
            icon="🌍"
            label="Countries"
            onPress={() => navigation.navigate('CountryList')}
          />
        </View>
        <View style={styles.grid}>
          <ShortcutButton
            icon="📦"
            label="Products"
            onPress={() => navigation.navigate('ProductList')}
          />
          <ShortcutButton
            icon="📰"
            label="News"
            onPress={() => navigation.navigate('ManageNews')}
          />
        </View>
        <View style={styles.grid}>
          <ShortcutButton
            icon="📚"
            label="Articles"
            onPress={() => navigation.navigate('ManageArticles')}
          />
          <ShortcutButton
            icon="🎓"
            label="Training"
            onPress={() => navigation.navigate('ManageTraining')}
          />
        </View>
        <View style={styles.grid}>
          <ShortcutButton
            icon="📅"
            label="Events"
            onPress={() => navigation.navigate('ManageEvents')}
          />
          <ShortcutButton
            icon="💳"
            label="Payments"
            onPress={() => navigation.navigate('PendingPayments')}
          />
        </View>

        <View style={styles.grid}>
          <ShortcutButton
            icon="🪪"
            label="KYC Review"
            onPress={() => navigation.navigate('ManageKyc')}
          />
          <ShortcutButton
            icon="📊"
            label="Analytics"
            onPress={() => navigation.navigate('CompanyAnalytics')}
          />
        </View>
        <View style={styles.grid}>
          <ShortcutButton
            icon="💵"
            label="Withdrawals"
            onPress={() => navigation.navigate('ManageWithdrawals')}
          />
          <ShortcutButton
            icon="💎"
            label="OPB Bonuses"
            onPress={() => navigation.navigate('ManageOPB')}
          />
        </View>
        <View style={styles.grid}>
          <ShortcutButton
            icon="💰"
            label="Commissions"
            onPress={() => navigation.navigate('ManageCommissions')}
          />
          <ShortcutButton
            icon="⚙️"
            label="System Jobs"
            onPress={() => navigation.navigate('SystemJobs')}
          />
        </View>

        <Card style={styles.tip}>
          <Text style={styles.tipTitle}>Admin Access</Text>
          <Text style={styles.tipBody}>
            Confirm payments, manage distributors and countries, update products, and publish
            company news, articles, training, and events.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  subtitle: { ...typography.body, color: colors.textSecondary },
  grid: { flexDirection: 'row', gap: spacing.md },
  placeholder: { flex: 1 },
  tip: { backgroundColor: colors.surfaceMuted },
  tipTitle: { ...typography.label, color: colors.primary, marginBottom: spacing.sm },
  tipBody: { ...typography.bodySmall, color: colors.textSecondary },
});
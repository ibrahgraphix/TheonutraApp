import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, ShopHeader, StatCard } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import {
  getCompanyOverview,
  getCountryPerformance,
  getProductPerformance,
  type CompanyOverview,
  type CountryPerformance,
  type ProductPerformance,
} from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'CompanyAnalytics'>;

export function CompanyAnalyticsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [countries, setCountries] = useState<CountryPerformance[]>([]);
  const [products, setProducts] = useState<ProductPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, cp, pp] = await Promise.all([
        getCompanyOverview(),
        getCountryPerformance(),
        getProductPerformance(),
      ]);
      setOverview(ov);
      setCountries(cp.sort((a, b) => b.totalSales - a.totalSales));
      setProducts(pp.slice(0, 10));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading || !overview) {
    return (
      <View style={styles.container}>
        <ShopHeader onBack={() => navigation.goBack()} title="Company Analytics" />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Company Analytics" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsGrid}>
          <StatCard
            label="Total Sales (USD)"
            value={formatCurrency(overview.totalSalesUSD, 'USD')}
          />
          <StatCard
            accent="secondary"
            label="Active Members"
            value={String(overview.activeMembers)}
          />
          <StatCard
            accent="secondary"
            label="Inactive Members"
            value={String(overview.inactiveMembers)}
          />
          <StatCard
            label="New This Month"
            value={String(overview.newRegistrationsThisMonth)}
          />
          <StatCard
            accent="secondary"
            label="Total Distributors"
            value={String(overview.totalDistributors)}
          />
        </View>

        <Text style={styles.sectionTitle}>Country Performance (USD)</Text>
        {countries.map((c) => (
          <Card key={c.countryId} style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>{c.countryName}</Text>
              <Text style={styles.rowMeta}>
                {c.distributorCount} distributor{c.distributorCount !== 1 ? 's' : ''} · {c.orderCount} order{c.orderCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.rowValue}>{formatCurrency(c.totalSalesUSD, 'USD')}</Text>
          </Card>
        ))}

        <Text style={styles.sectionTitle}>Top Products by Revenue (USD)</Text>
        {products.length === 0 ? (
          <Text style={styles.empty}>No sales data yet.</Text>
        ) : (
          products.map((p, index) => (
            <Card key={p.productId} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>
                  {index + 1}. {p.productName}
                </Text>
                <Text style={styles.rowMeta}>{p.unitsSold} unit{p.unitsSold !== 1 ? 's' : ''} sold</Text>
              </View>
              <Text style={styles.rowValue}>{formatCurrency(p.totalRevenueUSD, 'USD')}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flex: 1, gap: spacing.xs },
  rowTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  rowMeta: { ...typography.caption, color: colors.textSecondary },
  rowValue: { ...typography.body, color: colors.primary, fontWeight: '700' },
  empty: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', padding: spacing.lg },
});
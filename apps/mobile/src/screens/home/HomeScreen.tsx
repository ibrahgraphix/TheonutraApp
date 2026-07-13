import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import {
  Avatar,
  Badge,
  Card,
  ShortcutButton,
  StatCard,
} from '../../components';
import type { MainTabParamList } from '../../navigation/types';
import type { RootStackParamList } from '../../navigation/types';
import { getDashboardStats } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { DashboardStats } from '../../types';
import { colors, spacing, typography } from '../../theme';

type HomeNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function HomeScreen() {
  const navigation = useNavigation<HomeNavigationProp>();
  const distributor = useAuthStore((state) => state.distributor);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!distributor) return;
    const data = await getDashboardStats(distributor.id);
    setStats(data);
  }, [distributor]);

  useEffect(() => {
    loadStats().finally(() => setLoading(false));
  }, [loadStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  if (!distributor) {
    return null;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Image
          accessibilityLabel="Theonutra"
          contentFit="contain"
          source={require('../../../assets/logo.png')}
          style={styles.headerLogo}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.welcomeCard}>
          <View style={styles.welcomeRow}>
            <Avatar name={distributor.fullName} size={56} />
            <View style={styles.welcomeText}>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.name}>{distributor.fullName}</Text>
              <View style={styles.metaRow}>
                <Badge label={distributor.distributorId} variant="secondary" />
                <Text style={styles.country}>{distributor.country}</Text>
              </View>
            </View>
          </View>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>This Month</Text>
          {stats ? (
            <Badge label={stats.period} variant="neutral" />
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : stats ? (
          <View style={styles.statsRow}>
            <StatCard
              label="Personal Sales"
              value={formatCurrency(stats.personalSales, stats.currency)}
            />
            <StatCard
              accent="secondary"
              label="Team Sales"
              value={formatCurrency(stats.teamSales, stats.currency)}
            />
            <StatCard
              accent="secondary"
              label="Bonus Earned"
              value={formatCurrency(stats.bonusEarned, stats.currency)}
            />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.shortcutsGrid}>
          <ShortcutButton
            icon="🛒"
            label="Shop"
            onPress={() => navigation.navigate('Shop')}
          />
          <ShortcutButton
            icon="👥"
            label="Team"
            onPress={() => navigation.navigate('Team')}
          />
        </View>
        <View style={styles.shortcutsGrid}>
          <ShortcutButton
            icon="📰"
            label="News"
            onPress={() => navigation.navigate('News')}
          />
          <ShortcutButton
            icon="📚"
            label="Articles"
            onPress={() => navigation.navigate('Articles')}
          />
        </View>

        <Card style={styles.tipCard}>
          <Text style={styles.tipTitle}>Grow Your Network</Text>
          <Text style={styles.tipBody}>
            Share wellness products and recruit new distributors to increase your team
            sales and monthly bonuses.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLogo: {
    height: 40,
    width: 160,
  },
  container: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  welcomeCard: {
    backgroundColor: colors.surface,
  },
  welcomeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  welcomeText: {
    flex: 1,
    gap: spacing.xs,
  },
  greeting: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  country: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tipCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.secondaryLight,
  },
  tipTitle: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  tipBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});

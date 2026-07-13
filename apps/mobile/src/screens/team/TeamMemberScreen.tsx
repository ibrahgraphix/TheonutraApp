import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar, Badge, ShopHeader, TeamMemberRow } from '../../components';
import type { TeamStackParamList } from '../../navigation/teamTypes';
import { getDistributorById, getTeam } from '../../services/api';
import { getCurrencyForCountry } from '../../services/mockData';
import type { Distributor, TeamMember } from '../../types';
import { formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<TeamStackParamList, 'TeamMember'>;
type ScreenRoute = RouteProp<TeamStackParamList, 'TeamMember'>;

export function TeamMemberScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const [member, setMember] = useState<Distributor | null>(null);
  const [subteam, setSubteam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDistributorById(route.params.distributorId),
      getTeam(route.params.distributorId),
    ])
      .then(([dist, team]) => {
        setMember(dist);
        setSubteam(team);
      })
      .finally(() => setLoading(false));
  }, [route.params.distributorId]);

  const currency = member ? getCurrencyForCountry(member.country) : 'USD';

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Team Member" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : !member ? (
        <Text style={styles.error}>Member not found.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.profile}>
            <Avatar name={member.fullName} size={64} />
            <Text style={styles.name}>{member.fullName}</Text>
            <Badge label={member.distributorId} variant="secondary" />
            <Text style={styles.meta}>
              {member.country} · Joined {formatDate(member.joinDate)}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>
            Direct Recruits ({subteam.length})
          </Text>

          {subteam.length === 0 ? (
            <Text style={styles.empty}>No recruits yet.</Text>
          ) : (
            subteam.map((m) => (
              <TeamMemberRow
                key={m.distributor.id}
                currency={currency}
                member={m}
                onPress={() =>
                  navigation.push('TeamMember', { distributorId: m.distributor.id })
                }
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  error: {
    ...typography.body,
    color: colors.error,
    padding: spacing.xxl,
    textAlign: 'center',
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  profile: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  meta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

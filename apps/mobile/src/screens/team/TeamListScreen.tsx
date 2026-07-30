//TeaamListScreen
import { useNavigation } from '@react-navigation/native';
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

import { ShopHeader, TeamMemberRow } from '../../components';
import type { TeamStackParamList } from '../../navigation/teamTypes';
import { getTeam } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { TeamMember } from '../../types';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<TeamStackParamList, 'TeamList'>;

function TeamTree({
  members,
  expandedIds,
  onToggle,
  onPressMember,
  depth = 0,
}: {
  members: TeamMember[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onPressMember: (id: string) => void;
  depth?: number;
}) {
  return (
    <>
      {members.map((member) => {
        const id = member.distributor.id;
        const expanded = expandedIds.has(id);
        return (
          <View key={id}>
            <TeamMemberRow
              depth={depth}
              expanded={expanded}
              member={member}
              onPress={() => onPressMember(id)}
              onToggle={() => onToggle(id)}
            />
            {expanded && member.children.length > 0 ? (
              <TeamTree
                depth={depth + 1}
                expandedIds={expandedIds}
                members={member.children}
                onPressMember={onPressMember}
                onToggle={onToggle}
              />
            ) : null}
          </View>
        );
      })}
    </>
  );
}

export function TeamListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const distributor = useAuthStore((s) => s.distributor);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!distributor) return;
    const data = await getTeam(distributor.id);
    setTeam(data);
  }, [distributor]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <ShopHeader title="My Team" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} />
        }
      >
        <Text style={styles.subtitle}>
          {team.length} direct recruit{team.length !== 1 ? 's' : ''} · Tap a member to view their
          downline
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : team.length === 0 ? (
          <Text style={styles.empty}>No team members yet. Start recruiting to build your network.</Text>
        ) : (
          <TeamTree
            expandedIds={expandedIds}
            members={team}
            onPressMember={(id) => navigation.navigate('TeamMember', { distributorId: id })}
            onToggle={toggleExpand}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

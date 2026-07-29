import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TeamMember } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';
import { Avatar } from './Avatar';

interface TeamMemberRowProps {
  member: TeamMember;
  currency: string;
  depth?: number;
  expanded?: boolean;
  onToggle?: () => void;
  onPress: () => void;
}

const RANK_COLORS: Record<string, string> = {
  '1 Star': '#6b7280',
  '2 Star': '#94a3b8',
  '3 Star': '#cd7f32',
  '4 Star': '#06b6d4',
  '5 Star': '#f59e0b',
  '6 Star': '#8b5cf6',
  L: '#dc2626',
};

const LEADERSHIP_COLOR = '#059669';

export function TeamMemberRow({
  member,
  currency,
  depth = 0,
  expanded,
  onToggle,
  onPress,
}: TeamMemberRowProps) {
  const hasChildren = member.children.length > 0;
  const rankColor = member.activeStatusRankName
    ? (RANK_COLORS[member.activeStatusRankName] ?? colors.primary)
    : undefined;

  return (
    <View style={[styles.wrapper, { marginLeft: depth * spacing.lg }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {hasChildren ? (
          <Pressable
            accessibilityLabel={expanded ? 'Collapse' : 'Expand'}
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggle?.();
            }}
            style={styles.chevron}
          >
            <Text style={styles.chevronText}>{expanded ? '▼' : '▶'}</Text>
          </Pressable>
        ) : (
          <View style={styles.chevronPlaceholder} />
        )}
        <Avatar name={member.distributor.fullName} size={40} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{member.distributor.fullName}</Text>
            {member.activeStatusRankName ? (
              <View style={[styles.badge, { backgroundColor: rankColor }]}>
                <Text style={styles.badgeText}>{member.activeStatusRankName}</Text>
              </View>
            ) : null}
            {member.leadershipRankName ? (
              <View style={[styles.badge, { backgroundColor: LEADERSHIP_COLOR }]}>
                <Text style={styles.badgeText}>{member.leadershipRankName}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta}>
            {member.distributor.distributorId} · Joined{' '}
            {formatDate(member.distributor.joinDate)}
          </Text>
          <Text style={styles.sales}>
            Personal sales: {formatCurrency(member.personalSales, currency)}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.sm,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  chevron: {
    width: 20,
  },
  chevronPlaceholder: {
    width: 20,
  },
  chevronText: {
    color: colors.primary,
    fontSize: 12,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  name: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sales: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});
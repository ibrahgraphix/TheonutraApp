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

export function TeamMemberRow({
  member,
  currency,
  depth = 0,
  expanded,
  onToggle,
  onPress,
}: TeamMemberRowProps) {
  const hasChildren = member.children.length > 0;

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
          <Text style={styles.name}>{member.distributor.fullName}</Text>
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
  name: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
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

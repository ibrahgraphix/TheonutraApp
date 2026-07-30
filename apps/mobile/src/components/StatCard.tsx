import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string;
  accent?: 'primary' | 'secondary';
}

export function StatCard({ label, value, accent = 'primary' }: StatCardProps) {
  return (
    <Card style={styles.card}>
      <View
        style={[
          styles.accentBar,
          accent === 'secondary' ? styles.accentSecondary : styles.accentPrimary,
        ]}
      />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '30%',
    overflow: 'hidden',
    paddingTop: spacing.lg,
  },
  accentBar: {
    height: 3,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  accentPrimary: {
    backgroundColor: colors.primary,
  },
  accentSecondary: {
    backgroundColor: colors.secondary,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
});

import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type BadgeVariant = 'primary' | 'secondary' | 'neutral' | 'success' | 'error';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: any;
}

export function Badge({ label, variant = 'primary', style }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant], style]}>
      <Text style={[styles.text, styles[`${variant}Text`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  primary: {
    backgroundColor: colors.primaryLight,
  },
  secondary: {
    backgroundColor: colors.secondaryLight,
  },
  neutral: {
    backgroundColor: colors.surfaceMuted,
  },
  success: {
    backgroundColor: '#DCFCE7',
  },
  error: {
    backgroundColor: '#FEE2E2',
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
  primaryText: {
    color: colors.textOnPrimary,
  },
  secondaryText: {
    color: colors.textOnSecondary,
  },
  neutralText: {
    color: colors.textSecondary,
  },
  successText: {
    color: colors.success,
  },
  errorText: {
    color: colors.error,
  },
});

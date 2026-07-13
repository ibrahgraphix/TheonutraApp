import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type BadgeVariant = 'primary' | 'secondary' | 'neutral' | 'success';

interface BadgeProps extends ViewProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'primary', style, ...props }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant], style]} {...props}>
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
});

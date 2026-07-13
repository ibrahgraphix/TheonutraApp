import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? colors.textOnSecondary : colors.textOnPrimary}
        />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`]]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  sm: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  md: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  lg: {
    minHeight: 56,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  text: {
    ...typography.label,
  },
  primaryText: {
    color: colors.textOnPrimary,
  },
  secondaryText: {
    color: colors.textOnSecondary,
  },
  outlineText: {
    color: colors.primary,
  },
  ghostText: {
    color: colors.primary,
  },
  smText: {
    fontSize: 13,
  },
  mdText: {
    fontSize: 15,
  },
  lgText: {
    fontSize: 16,
  },
});

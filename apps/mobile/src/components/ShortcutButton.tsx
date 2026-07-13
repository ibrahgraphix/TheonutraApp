import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface ShortcutButtonProps {
  label: string;
  icon: string;
  onPress: () => void;
}

export function ShortcutButton({ label, icon, onPress }: ShortcutButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 96,
    padding: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  icon: {
    fontSize: 28,
  },
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
});

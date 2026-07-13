import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
}

export function ListItem({ title, subtitle, left, right, onPress }: ListItemProps) {
  const content = (
    <>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});

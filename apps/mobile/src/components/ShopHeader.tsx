import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '../theme';

interface ShopHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: ReactNode;
}

export function ShopHeader({ title, onBack, rightAction }: ShopHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Text style={styles.title}>{title}</Text>
        <View style={styles.right}>{rightAction ?? <View style={styles.backPlaceholder} />}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  backPlaceholder: {
    width: 36,
  },
  backText: {
    color: colors.textOnPrimary,
    fontSize: 22,
    fontWeight: '600',
  },
  title: {
    ...typography.h3,
    color: colors.textOnPrimary,
    flex: 1,
    textAlign: 'center',
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 36,
  },
});

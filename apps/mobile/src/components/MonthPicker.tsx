import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface MonthPickerProps {
  months: string[];
  labels: Record<string, string>;
  selected: string;
  onSelect: (month: string) => void;
}

export function MonthPicker({ months, labels, selected, onSelect }: MonthPickerProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {months.map((month) => {
        const active = month === selected;
        return (
          <Pressable
            key={month}
            onPress={() => onSelect(month)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {labels[month] ?? month}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
});

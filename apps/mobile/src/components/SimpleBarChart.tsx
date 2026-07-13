import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface BarChartItem {
  label: string;
  value: number;
  color: string;
}

interface SimpleBarChartProps {
  data: BarChartItem[];
  formatValue?: (value: number) => string;
}

export function SimpleBarChart({ data, formatValue }: SimpleBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.container}>
      {data.map((item) => {
        const height = Math.max((item.value / max) * 120, 4);
        return (
          <View key={item.label} style={styles.barGroup}>
            <Text style={styles.value}>
              {formatValue ? formatValue(item.value) : item.value}
            </Text>
            <View style={[styles.bar, { height, backgroundColor: item.color }]} />
            <Text style={styles.label}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.lg,
    height: 160,
    justifyContent: 'space-around',
    paddingTop: spacing.md,
  },
  barGroup: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  bar: {
    borderRadius: radius.sm,
    width: '70%',
  },
  value: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
});

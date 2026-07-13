import { StyleSheet, Text, View } from 'react-native';

import type { CartItem } from '../types';
import { formatCurrency } from '../utils/format';
import { colors, spacing, typography } from '../theme';
import { Card } from './Card';

interface OrderSummaryProps {
  items: CartItem[];
  total: number;
  currency: string;
}

export function OrderSummary({ items, total, currency }: OrderSummaryProps) {
  return (
    <Card>
      <Text style={styles.title}>Order Summary</Text>
      {items.map((item) => (
        <View key={item.productId} style={styles.row}>
          <Text style={styles.itemName}>
            {item.name} × {item.quantity}
          </Text>
          <Text style={styles.itemPrice}>
            {formatCurrency(item.price * item.quantity, item.currency)}
          </Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(total, currency)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  itemName: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.md,
  },
  itemPrice: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.md,
  },
  totalLabel: {
    ...typography.label,
    color: colors.text,
  },
  totalValue: {
    ...typography.h3,
    color: colors.primary,
  },
});

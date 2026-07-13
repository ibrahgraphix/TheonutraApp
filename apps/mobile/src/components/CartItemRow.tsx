import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CartItem } from '../types';
import { formatCurrency } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';
import { QuantitySelector } from './QuantitySelector';

interface CartItemRowProps {
  item: CartItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function CartItemRow({ item, onQuantityChange, onRemove }: CartItemRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text numberOfLines={2} style={styles.name}>
          {item.name}
        </Text>
        <Text style={styles.unitPrice}>
          {formatCurrency(item.price, item.currency)} each
        </Text>
        <Text style={styles.lineTotal}>
          {formatCurrency(item.price * item.quantity, item.currency)}
        </Text>
      </View>
      <View style={styles.actions}>
        <QuantitySelector onChange={onQuantityChange} value={item.quantity} />
        <Pressable accessibilityRole="button" onPress={onRemove}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  info: {
    gap: spacing.xs,
  },
  name: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  unitPrice: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  lineTotal: {
    ...typography.label,
    color: colors.primary,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  remove: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
});

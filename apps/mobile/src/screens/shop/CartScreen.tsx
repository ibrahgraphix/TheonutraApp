import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, CartItemRow, OrderSummary, ShopHeader } from '../../components';
import type { ShopStackParamList } from '../../navigation/shopTypes';
import { useCartStore } from '../../store/cartStore';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ShopStackParamList, 'Cart'>;

export function CartScreen() {
  const navigation = useNavigation<NavigationProp>();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const getTotal = useCartStore((s) => s.getTotal);
  const currency = useCartStore((s) => s.getCurrency()) ?? 'USD';
  const total = getTotal();

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <ShopHeader onBack={() => navigation.goBack()} title="Cart" />
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Browse products and add items to get started.</Text>
          <Button
            onPress={() => navigation.navigate('ShopList')}
            title="Browse Shop"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Cart" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <CartItemRow
            key={item.productId}
            item={item}
            onQuantityChange={(qty) => updateQuantity(item.productId, qty)}
            onRemove={() => removeItem(item.productId)}
          />
        ))}
        <OrderSummary currency={currency} items={items} total={total} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          fullWidth
          onPress={() => navigation.navigate('Checkout')}
          title="Proceed to Checkout"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: spacing.lg,
  },
});

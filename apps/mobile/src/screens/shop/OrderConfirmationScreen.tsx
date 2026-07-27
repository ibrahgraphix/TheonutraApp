//OrderConfirmationScreen
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Badge, Button, Card, ShopHeader } from '../../components';
import type { ShopStackParamList } from '../../navigation/shopTypes';
import { getOrderById } from '../../services/api';
import type { Order } from '../../types';
import { formatCurrency } from '../../utils/format';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ShopStackParamList, 'OrderConfirmation'>;
type ScreenRoute = RouteProp<ShopStackParamList, 'OrderConfirmation'>;

export function OrderConfirmationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrderById(route.params.orderId)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [route.params.orderId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ShopHeader title="Order Confirmed" />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <ShopHeader title="Order" />
        <Text style={styles.error}>Order not found.</Text>
      </View>
    );
  }

  const paymentLabel =
    order.payment.method === 'bank_transfer'
      ? `Bank Transfer${order.payment.reference ? ` · Ref: ${order.payment.reference}` : ''}`
      : `${order.payment.provider} · ${order.payment.phone}`;

  return (
    <View style={styles.container}>
      <ShopHeader title="Order Submitted" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successIcon}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        <Text style={styles.title}>Thank you!</Text>
        <Text style={styles.subtitle}>
          Your order has been submitted and is awaiting payment confirmation.
        </Text>

        <Badge label="Pending Confirmation" variant="secondary" />

        <Card style={styles.orderCard}>
          <Text style={styles.orderId}>Order #{order.id.replace('ord-', '')}</Text>

          {order.items.map((item) => (
            <View key={item.productId} style={styles.row}>
              <Text style={styles.itemName}>
                {item.productName} × {item.quantity}
              </Text>
              <Text style={styles.itemPrice}>
                {formatCurrency(item.unitPrice * item.quantity, order.currency)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(order.total, order.currency)}
            </Text>
          </View>

          <View style={styles.divider} />

          <Detail label="Payment Method" value={paymentLabel} />
          <Detail label="Country" value={order.country} />
          <Detail
            label="Status"
            value="Pending Confirmation"
            valueColor={colors.warning}
          />
        </Card>

        <Text style={styles.note}>
          An admin will verify your payment and confirm your order. You will be notified
          once confirmed.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          fullWidth
          onPress={() => navigation.navigate('ShopList')}
          title="Continue Shopping"
        />
      </View>
    </View>
  );
}

function Detail({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  error: {
    ...typography.body,
    color: colors.error,
    padding: spacing.xxl,
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  checkmark: {
    color: colors.textOnPrimary,
    fontSize: 36,
    fontWeight: '700',
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  orderCard: {
    alignSelf: 'stretch',
    width: '100%',
  },
  orderId: {
    ...typography.caption,
    color: colors.textSecondary,
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  note: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: spacing.lg,
  },
});

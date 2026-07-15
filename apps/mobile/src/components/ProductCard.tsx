import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ProductListing } from '../types';
import { formatCurrency, getProductEmoji } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';
import { Badge } from './Badge';
import { Card } from './Card';

interface ProductCardProps {
  product: ProductListing;
  onPress: () => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const hasRemoteImage = Boolean(product.imageUrl?.startsWith('http'));

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
    >
      <Card elevated padded={false} style={styles.card}>
        <View style={styles.imagePlaceholder}>
          {hasRemoteImage ? (
            <Image contentFit="cover" source={{ uri: product.imageUrl }} style={styles.image} />
          ) : (
            <Text style={styles.emoji}>{getProductEmoji(product.category)}</Text>
          )}
        </View>
        <View style={styles.content}>
          <Badge label={product.category} variant="neutral" />
          <Text numberOfLines={2} style={styles.name}>
            {product.name}
          </Text>
          <Text style={styles.price}>
            {formatCurrency(product.price, product.currency)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    maxWidth: '50%',
  },
  pressed: {
    opacity: 0.92,
  },
  card: {
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    height: 110,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  emoji: {
    fontSize: 40,
  },
  content: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  name: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    minHeight: 40,
  },
  price: {
    ...typography.label,
    color: colors.primary,
  },
});

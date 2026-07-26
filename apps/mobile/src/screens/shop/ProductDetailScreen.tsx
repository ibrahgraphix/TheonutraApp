//productDetails
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Badge, Button, QuantitySelector, ShopHeader } from '../../components';
import type { ShopStackParamList } from '../../navigation/shopTypes';
import { getProductById } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { useShopStore } from '../../store/shopStore';
import type { ProductListing } from '../../types';
import { formatCurrency, getProductEmoji } from '../../utils/format';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ShopStackParamList, 'ProductDetail'>;
type ScreenRoute = RouteProp<ShopStackParamList, 'ProductDetail'>;

export function ProductDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const distributor = useAuthStore((s) => s.distributor);
  const browseCountry = useShopStore((s) => s.browseCountry);
  const activeCountry = browseCountry ?? distributor?.country ?? '';
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const [product, setProduct] = useState<ProductListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!activeCountry) return;
    setLoading(true);
    getProductById(route.params.productId, activeCountry)
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [activeCountry, route.params.productId]);

  const cartPayload = () => {
    if (!product) return null;
    return {
      productId: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      imageUrl: product.imageUrl,
    };
  };

  const handleAddToCart = () => {
    const item = cartPayload();
    if (!item) return;
    addItem(item, quantity);
    Alert.alert('Added to cart', `${product?.name} × ${quantity} added.`);
  };

  const handleBuyNow = () => {
    const item = cartPayload();
    if (!item) return;
    clearCart();
    addItem(item, quantity);
    navigation.navigate('Checkout');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ShopHeader onBack={() => navigation.goBack()} title="Product" />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.container}>
        <ShopHeader onBack={() => navigation.goBack()} title="Product" />
        <Text style={styles.error}>Product not available in your country.</Text>
      </View>
    );
  }

  const hasRemoteImage = Boolean(product.imageUrl?.startsWith('http'));

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Product" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.imagePlaceholder}>
          {hasRemoteImage ? (
            <Image contentFit="cover" source={{ uri: product.imageUrl }} style={styles.image} />
          ) : (
            <Text style={styles.emoji}>{getProductEmoji(product.category)}</Text>
          )}
        </View>

        <View style={styles.meta}>
          <Badge label={product.category} variant="neutral" />
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>
            {formatCurrency(product.price, product.currency)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{product.description}</Text>

        <View style={styles.quantityRow}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <QuantitySelector onChange={setQuantity} value={quantity} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          onPress={handleAddToCart}
          style={styles.footerButton}
          title="Add to Cart"
          variant="outline"
        />
        <Button
          onPress={handleBuyNow}
          style={styles.footerButton}
          title="Buy Now"
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
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  imagePlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 200,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  emoji: {
    fontSize: 72,
  },
  meta: {
    gap: spacing.sm,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  price: {
    ...typography.h2,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  quantityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  footerButton: {
    flex: 1,
  },
});

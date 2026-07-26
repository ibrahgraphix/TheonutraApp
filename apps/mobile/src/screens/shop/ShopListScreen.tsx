//shopListScreen  
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CountryPicker, ProductCard, ShopHeader } from '../../components';
import type { ShopStackParamList } from '../../navigation/shopTypes';
import { getProductCountries, getProducts } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { useShopStore } from '../../store/shopStore';
import type { ProductListing } from '../../types';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ShopStackParamList, 'ShopList'>;

function CartButton({ onPress, count }: { onPress: () => void; count: number }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.cartButton}>
      <Text style={styles.cartIcon}>🛒</Text>
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ShopListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const distributor = useAuthStore((s) => s.distributor);
  const browseCountry = useShopStore((s) => s.browseCountry);
  const setBrowseCountry = useShopStore((s) => s.setBrowseCountry);
  const itemCount = useCartStore((s) => s.getItemCount());
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const activeCountry = browseCountry ?? distributor?.country ?? '';

  useEffect(() => {
    if (distributor && !browseCountry) {
      setBrowseCountry(distributor.country);
    }
  }, [distributor, browseCountry, setBrowseCountry]);

  useEffect(() => {
    getProductCountries().then((list) => {
      setCountries(list);
      if (!browseCountry && list.length > 0) {
        const preferred =
          (distributor?.country && list.includes(distributor.country)
            ? distributor.country
            : list[0]) ?? '';
        if (preferred) setBrowseCountry(preferred);
      }
    });
  }, [browseCountry, distributor?.country, setBrowseCountry]);

  const loadProducts = useCallback(async () => {
    if (!activeCountry) return;
    setLoading(true);
    try {
      const data = await getProducts(activeCountry);
      setProducts(data);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [activeCountry]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  return (
    <View style={styles.container}>
      <ShopHeader
        rightAction={
          <CartButton count={itemCount} onPress={() => navigation.navigate('Cart')} />
        }
        title="Shop"
      />

      <View style={styles.controls}>
        <CountryPicker
          countries={countries}
          onSelect={setBrowseCountry}
          registeredCountry={distributor?.country}
          selected={activeCountry}
        />
        <Text style={styles.productCount}>
          {loading ? 'Loading…' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : products.length === 0 ? (
        <Text style={styles.empty}>No products available for {activeCountry}.</Text>
      ) : (
        <FlatList
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <ProductCard
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
              product={item}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  controls: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  productCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    padding: spacing.xxl,
    textAlign: 'center',
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  row: {
    gap: spacing.md,
  },
  cartButton: {
    position: 'relative',
  },
  cartIcon: {
    fontSize: 22,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 10,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    position: 'absolute',
    right: -6,
    top: -6,
  },
  badgeText: {
    ...typography.caption,
    color: colors.textOnSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
});

import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, Card, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { getAllProducts, saveProduct } from '../../services/api';
import type { Product, ProductCountryPrice } from '../../types';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'AddEditProduct'>;
type ScreenRoute = RouteProp<ManageStackParamList, 'AddEditProduct'>;

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  description: z.string().min(10, 'Description required'),
  category: z.string().min(2, 'Category required'),
});

const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa'] as const;

export function AddEditProductScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const [pricing, setPricing] = useState<ProductCountryPrice[]>([]);
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit, reset } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', category: 'Supplements' },
  });

  useEffect(() => {
    if (route.params.productId) {
      getAllProducts().then((products) => {
        const p = products.find((x) => x.id === route.params.productId);
        if (p) {
          reset({ name: p.name, description: p.description, category: p.category });
          setPricing(p.pricing);
        }
      });
    } else {
      setPricing(
        COUNTRIES.map((country) => ({
          country,
          price: 0,
          currency: country === 'Nigeria' ? 'NGN' : country === 'Ghana' ? 'GHS' : country === 'Kenya' ? 'KES' : 'ZAR',
          available: false,
        })),
      );
    }
  }, [route.params.productId, reset]);

  const updatePrice = (country: string, field: keyof ProductCountryPrice, value: string | boolean) => {
    setPricing((prev) =>
      prev.map((p) =>
        p.country === country
          ? {
              ...p,
              [field]:
                field === 'price'
                  ? Number(value) || 0
                  : field === 'available'
                    ? Boolean(value)
                    : value,
            }
          : p,
      ),
    );
  };

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true);
    try {
      const product: Product = {
        id: route.params.productId ?? `prod-${Date.now()}`,
        name: data.name,
        description: data.description,
        category: data.category,
        pricing: pricing.filter((p) => p.available && p.price > 0),
      };
      await saveProduct(product);
      Alert.alert('Saved', 'Product saved successfully.');
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save product.');
    } finally {
      setSaving(false);
    }
  });

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={() => navigation.goBack()}
        title={route.params.productId ? 'Edit Product' : 'Add Product'}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.imagePlaceholder}>
          <Text style={styles.imageEmoji}>🖼️</Text>
          <Text style={styles.imageHint}>Image upload placeholder</Text>
        </Card>

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input error={error?.message} label="Product Name" onChangeText={onChange} value={value} />
          )}
        />
        <Controller
          control={control}
          name="category"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input error={error?.message} label="Category" onChangeText={onChange} value={value} />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input
              error={error?.message}
              label="Description"
              multiline
              numberOfLines={4}
              onChangeText={onChange}
              style={styles.textArea}
              value={value}
            />
          )}
        />

        <Text style={styles.sectionTitle}>Pricing by Country</Text>
        {pricing.map((p) => (
          <Card key={p.country} style={styles.priceCard}>
            <Text style={styles.countryLabel}>{p.country}</Text>
            <Input
              keyboardType="numeric"
              label="Price"
              onChangeText={(v) => updatePrice(p.country, 'price', v)}
              value={p.price > 0 ? String(p.price) : ''}
            />
            <Input
              label="Currency"
              onChangeText={(v) => updatePrice(p.country, 'currency', v)}
              value={p.currency}
            />
            <Button
              onPress={() => updatePrice(p.country, 'available', !p.available)}
              title={p.available ? 'Available ✓' : 'Mark Available'}
              variant={p.available ? 'secondary' : 'outline'}
            />
          </Card>
        ))}

        <Button fullWidth loading={saving} onPress={onSubmit} title="Save Product" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  imagePlaceholder: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  imageEmoji: { fontSize: 48 },
  imageHint: { ...typography.caption, color: colors.textSecondary },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  sectionTitle: { ...typography.h3, color: colors.text },
  priceCard: { gap: spacing.md },
  countryLabel: { ...typography.label, color: colors.primary },
});

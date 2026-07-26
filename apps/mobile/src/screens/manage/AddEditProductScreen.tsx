import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';

import { Button, Card, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import {
  createProduct,
  getCountries,
  getProductForAdmin,
  updateProduct,
  uploadProductImage,
} from '../../services/api';
import type { Country } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'AddEditProduct'>;
type ScreenRoute = RouteProp<ManageStackParamList, 'AddEditProduct'>;

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  description: z.string().min(10, 'Description required'),
});

type PriceRow = {
  countryId: string;
  countryName: string;
  currency: string;
  price: number;
  distributorPrice: number;
  available: boolean;
};

export function AddEditProductScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const productId = route.params.productId;
  const isEdit = Boolean(productId);

  const [pricing, setPricing] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const countries: Country[] = await getCountries();

        if (isEdit && productId) {
          const product = await getProductForAdmin(productId);
          reset({ name: product.name, description: product.description ?? '' });
          setImageUrl(product.imageUrl ?? undefined);

          const priceByCountry = new Map(product.pricing.map((p) => [p.countryId, p]));
          setPricing(
            countries.map((c) => {
              const existing = priceByCountry.get(c.id);
              return {
                countryId: c.id,
                countryName: c.name,
                currency: c.currencyCode,
                price: existing?.price ?? 0,
                distributorPrice: existing?.distributorPrice ?? 0,
                available: existing?.isAvailable ?? false,
              };
            }),
          );
        } else {
          setPricing(
            countries.map((c) => ({
              countryId: c.id,
              countryName: c.name,
              currency: c.currencyCode,
              price: 0,
              distributorPrice: 0,
              available: false,
            })),
          );
        }

        if (countries.length === 0) {
          setLoadError('No countries in the database. Add a country under Manage → Countries first.');
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load product data');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isEdit, productId, reset]);

  const updatePrice = (
    countryId: string,
    field: 'price' | 'distributorPrice' | 'available',
    value: string | boolean,
  ) => {
    setPricing((prev) =>
      prev.map((p) =>
        p.countryId === countryId
          ? {
              ...p,
              [field]:
                field === 'available' ? Boolean(value) : Number(value) || 0,
            }
          : p,
      ),
    );
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a product image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setLocalImageUri(uri);
    setUploading(true);
    try {
      const uploadedUrl = await uploadProductImage(uri);
      setImageUrl(uploadedUrl);
    } catch (err) {
      setLocalImageUri(null);
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload image. Check Cloudinary config.',
      );
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    const prices = pricing
      .filter((p) => p.available && p.price > 0)
      .map((p) => ({
        countryId: p.countryId,
        price: p.price,
        distributorPrice: p.distributorPrice,
        isAvailable: true,
      }));

    if (prices.length === 0) {
      Alert.alert('Pricing required', 'Mark at least one country as available and set a price.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && productId) {
        await updateProduct(productId, {
          name: data.name.trim(),
          description: data.description.trim(),
          imageUrl,
          prices,
        });
        Alert.alert('Saved', 'Product updated.');
      } else {
        await createProduct({
          name: data.name.trim(),
          description: data.description.trim(),
          imageUrl,
          prices,
        });
        Alert.alert('Saved', 'Product saved and is available in the shop for priced countries.');
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save product.');
    } finally {
      setSaving(false);
    }
  });

  const previewUri = localImageUri ?? imageUrl;

  if (loading) {
    return (
      <View style={styles.container}>
        <ShopHeader onBack={() => navigation.goBack()} title={isEdit ? 'Edit Product' : 'Add Product'} />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={() => navigation.goBack()}
        title={isEdit ? 'Edit Product' : 'Add Product'}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={pickImage} style={styles.imageCard}>
          {previewUri ? (
            <Image contentFit="cover" source={{ uri: previewUri }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imageEmoji}>🖼️</Text>
              <Text style={styles.imageHint}>Tap to upload product image</Text>
            </View>
          )}
          {uploading ? (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color={colors.textOnPrimary} />
              <Text style={styles.uploadText}>Uploading…</Text>
            </View>
          ) : null}
        </Pressable>
        {imageUrl ? <Text style={styles.imageOk}>Image ready</Text> : null}

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input error={error?.message} label="Product Name" onChangeText={onChange} value={value} />
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
        {loadError ? (
          <Text style={styles.error}>{loadError}</Text>
        ) : (
          pricing.map((p) => (
            <Card key={p.countryId} style={styles.priceCard}>
              <Text style={styles.countryLabel}>
                {p.countryName} ({p.currency})
              </Text>
              <Input
                keyboardType="numeric"
                label="Customer Price"
                onChangeText={(v) => updatePrice(p.countryId, 'price', v)}
                value={p.price > 0 ? String(p.price) : ''}
              />
              <Input
                keyboardType="numeric"
                label="Distributor Price"
                onChangeText={(v) => updatePrice(p.countryId, 'distributorPrice', v)}
                value={p.distributorPrice > 0 ? String(p.distributorPrice) : ''}
              />
              <Button
                onPress={() => updatePrice(p.countryId, 'available', !p.available)}
                title={p.available ? 'Available ✓' : 'Mark Available'}
                variant={p.available ? 'secondary' : 'outline'}
              />
            </Card>
          ))
        )}

        <Button
          disabled={Boolean(loadError) || uploading}
          fullWidth
          loading={saving}
          onPress={onSubmit}
          title={isEdit ? 'Save Changes' : 'Save Product'}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  imageCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  image: { height: 200, width: '100%' },
  imagePlaceholder: {
    alignItems: 'center',
    gap: spacing.sm,
    height: 200,
    justifyContent: 'center',
  },
  imageEmoji: { fontSize: 48 },
  imageHint: { ...typography.caption, color: colors.textSecondary },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  uploadText: { ...typography.label, color: colors.textOnPrimary },
  imageOk: { ...typography.caption, color: colors.success },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  sectionTitle: { ...typography.h3, color: colors.text },
  priceCard: { gap: spacing.md },
  countryLabel: { ...typography.label, color: colors.primary },
  error: { ...typography.body, color: colors.error },
});
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Badge, ConfirmModal, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { activateProduct, deactivateProduct, listProductsForAdmin, type AdminProduct } from '../../services/api';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ProductList'>;
type ConfirmAction = { type: 'activate' | 'deactivate'; product: AdminProduct } | null;

export function ProductListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listProductsForAdmin()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction.type === 'activate') {
        await activateProduct(confirmAction.product.id);
      } else {
        await deactivateProduct(confirmAction.product.id);
      }
      setConfirmAction(null);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={() => navigation.navigate('AddEditProduct', {})} style={styles.headerAction}>
            <Text style={styles.headerActionText}>+ Add</Text>
          </Pressable>
        }
        title="Products"
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : products.length === 0 ? (
        <Text style={styles.empty}>No products yet.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                {item.imageUrl ? (
                  <Image contentFit="cover" source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Text style={styles.thumbEmoji}>📦</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <View style={styles.titleRow}>
                    <Text style={styles.name}>{item.name}</Text>
                    {!item.isActive ? <Badge label="Inactive" variant="error" /> : null}
                  </View>
                  <Text style={styles.meta}>
                    {item.pricing.length} countr{item.pricing.length === 1 ? 'y' : 'ies'} priced · PV {item.pv}
                  </Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => navigation.navigate('AddEditProduct', { productId: item.id })}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                {item.isActive ? (
                  <Pressable
                    onPress={() => setConfirmAction({ type: 'deactivate', product: item })}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.deactivateText}>Deactivate</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setConfirmAction({ type: 'activate', product: item })}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.activateText}>Activate</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}

      <ConfirmModal
        confirmLabel={confirmAction?.type === 'activate' ? 'Activate' : 'Deactivate'}
        destructive={confirmAction?.type === 'deactivate'}
        loading={processing}
        message={
          confirmAction?.type === 'activate'
            ? `Reactivate "${confirmAction.product.name}"? It will reappear in the shop for its priced countries.`
            : `Deactivate "${confirmAction?.product.name ?? ''}"? It will no longer appear in the shop, but existing orders and commissions referencing it stay intact.`
        }
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction?.type === 'activate' ? 'Activate Product?' : 'Deactivate Product?'}
        visible={confirmAction !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  empty: { ...typography.body, color: colors.textSecondary, padding: spacing.xxl, textAlign: 'center' },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  thumb: { borderRadius: radius.md, height: 56, width: 56 },
  thumbPlaceholder: { alignItems: 'center', backgroundColor: colors.background, justifyContent: 'center' },
  thumbEmoji: { fontSize: 24 },
  info: { flex: 1, gap: spacing.xs, justifyContent: 'center' },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textSecondary },
  actionRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  actionBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  actionText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  deactivateText: { ...typography.caption, color: colors.error, fontWeight: '600' },
  activateText: { ...typography.caption, color: colors.success, fontWeight: '600' },
  headerAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  headerActionText: { ...typography.label, color: colors.textOnPrimary },
});
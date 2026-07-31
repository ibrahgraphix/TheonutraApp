// CustomerSalesScreen — Distributor logs retail sales to external customers
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Card, ShopHeader } from '../../components';
import type { AccountStackParamList } from '../../navigation/accountTypes';
import {
  getMyCustomerSales,
  logCustomerSale,
  getProducts,
} from '../../services/api';
import type { CustomerSale, ProductListing } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';
import { useAuthStore } from '../../store/authStore';

type NavigationProp = NativeStackNavigationProp<AccountStackParamList, 'CustomerSales'>;

interface SaleLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCustomerPrice: number;
}

export function CustomerSalesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const distributor = useAuthStore((s) => s.distributor);

  const [sales, setSales] = useState<CustomerSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineItems, setLineItems] = useState<SaleLineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadSales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const data = await getMyCustomerSales();
      setSales(data);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load sales.');
    } finally {
      setLoadingSales(false);
    }
  }, []);

  useEffect(() => { void loadSales(); }, [loadSales]);

  useEffect(() => {
    if (!distributor?.country) return;
    getProducts(distributor.country)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [distributor?.country]);

  const openModal = () => {
    setCustomerName('');
    setCustomerPhone('');
    setLineItems([{ productId: '', productName: '', quantity: 1, unitCustomerPrice: 0 }]);
    setModalVisible(true);
  };

  const updateLineItem = (index: number, patch: Partial<SaleLineItem>) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const selectProduct = (index: number, product: ProductListing) => {
    updateLineItem(index, {
      productId: product.id,
      productName: product.name,
      // Default customer price = distributor price (distributor can override)
      unitCustomerPrice: product.price,
    });
  };

  const handleSubmit = async () => {
    if (!distributor) return;
    const validItems = lineItems.filter((li) => li.productId && li.quantity > 0);
    if (validItems.length === 0) {
      Alert.alert('Validation', 'Please add at least one product to the sale.');
      return;
    }
    setSubmitting(true);
    try {
      await logCustomerSale({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        countryId: distributor.countryId ?? distributor.country,
        items: validItems.map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
        })),
      });
      setModalVisible(false);
      Alert.alert('✅ Sale Logged', 'Your retail sale has been recorded. Retail profit is for reporting purposes only.', [
        { text: 'OK', onPress: loadSales },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to log sale.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalEarnings = (sales || []).reduce((sum, s) => {
    const items = s.items ?? [];
    return (
      sum +
      items.reduce(
        (iSum, item) =>
          iSum +
          (item.unitCustomerPrice - item.unitDistributorPrice) * item.quantity,
        0,
      )
    );
  }, 0);

  const totalPV = (sales || []).reduce((sum, s) => sum + (s.totalPV ?? 0), 0);

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Customer Sales" />

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Sales</Text>
          <Text style={styles.summaryValue}>{sales.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Retail Profit (Report)</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            {formatCurrency(totalEarnings, 'USD')}
          </Text>
          <Text style={styles.summaryNote}>Informational only</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total PV</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {totalPV.toFixed(1)}
          </Text>
        </View>
      </View>

      <Button
        onPress={openModal}
        style={styles.logButton}
        title="+ Log New Sale"
      />

      {loadingSales ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : sales.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>No Sales Yet</Text>
          <Text style={styles.emptyBody}>
            Record retail sales you make to customers to earn retail profit and PV.
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card style={styles.saleCard}>
              <View style={styles.saleHeader}>
                <View>
                  <Text style={styles.saleCustomer}>
                    {item.customerName ?? 'Anonymous Customer'}
                  </Text>
                  {item.customerPhone ? (
                    <Text style={styles.salePhone}>{item.customerPhone}</Text>
                  ) : null}
                </View>
                <Text style={styles.saleDate}>{formatDate(item.createdAt)}</Text>
              </View>

              {/* Items */}
              {(item.items ?? []).map((li) => {
                const profit = (li.unitCustomerPrice - li.unitDistributorPrice) * li.quantity;
                return (
                  <View key={li.id} style={styles.lineItem}>
                    <Text style={styles.lineItemName} numberOfLines={1}>
                      {li.productName ?? 'Product'} × {li.quantity}
                    </Text>
                    <View style={styles.lineItemRight}>
                      <Text style={styles.lineItemPrice}>
                        {formatCurrency(li.unitCustomerPrice * li.quantity, 'USD')}
                      </Text>
                      {profit > 0 && (
                        <Text style={styles.lineItemProfit}>+{formatCurrency(profit, 'USD')}</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              <View style={styles.saleTotals}>
                <Text style={styles.saleTotalLabel}>
                  Total {formatCurrency(item.totalAmount, 'USD')}
                </Text>
                <Text style={styles.salePV}>{item.totalPV?.toFixed(1) ?? '0.0'} PV</Text>
              </View>
            </Card>
          )}
        />
      )}

      {/* Log Sale Modal */}
      <Modal animationType="slide" transparent visible={modalVisible}>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Retail Sale</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Customer Info (optional)</Text>
              <TextInput
                placeholder="Customer Name"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
              />
              <TextInput
                placeholder="Customer Phone"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                style={styles.input}
                value={customerPhone}
                onChangeText={setCustomerPhone}
              />

              <Text style={styles.sectionLabel}>Products Sold</Text>

              {lineItems.map((li, index) => (
                <View key={index} style={styles.lineItemForm}>
                  <Text style={styles.lineItemFormLabel}>Item {index + 1}</Text>

                  {/* Product picker */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScroll}>
                    {loadingProducts ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      products.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => selectProduct(index, p)}
                          style={[
                            styles.productChip,
                            li.productId === p.id && styles.productChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.productChipText,
                              li.productId === p.id && styles.productChipTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>

                  <View style={styles.qtyRow}>
                    <Text style={styles.qtyLabel}>Qty:</Text>
                    <TouchableOpacity
                      onPress={() => updateLineItem(index, { quantity: Math.max(1, li.quantity - 1) })}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{li.quantity}</Text>
                    <TouchableOpacity
                      onPress={() => updateLineItem(index, { quantity: li.quantity + 1 })}
                      style={styles.qtyBtn}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {index > 0 && (
                    <TouchableOpacity
                      onPress={() => setLineItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Text style={styles.removeItem}>Remove item</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                onPress={() =>
                  setLineItems((prev) => [
                    ...prev,
                    { productId: '', productName: '', quantity: 1, unitCustomerPrice: 0 },
                  ])
                }
                style={styles.addItemBtn}
              >
                <Text style={styles.addItemText}>+ Add another product</Text>
              </TouchableOpacity>

              <Button
                loading={submitting}
                onPress={handleSubmit}
                style={styles.submitBtn}
                title="Submit Sale"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: { ...typography.caption, color: colors.textSecondary },
  summaryValue: { ...typography.h3, color: colors.text },
  summaryNote: { ...typography.caption, color: colors.textSecondary, fontSize: 10 },
  logButton: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  loader: { marginTop: spacing.xxxl },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  saleCard: { gap: spacing.sm },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  saleCustomer: { ...typography.label, color: colors.text },
  salePhone: { ...typography.caption, color: colors.textSecondary },
  saleDate: { ...typography.caption, color: colors.textSecondary },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineItemName: { ...typography.bodySmall, color: colors.text, flex: 1 },
  lineItemRight: { alignItems: 'flex-end' },
  lineItemPrice: { ...typography.bodySmall, color: colors.text },
  lineItemProfit: { ...typography.caption, color: colors.success },
  saleTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  saleTotalLabel: { ...typography.label, color: colors.text },
  salePV: { ...typography.label, color: colors.primary },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.h3, color: colors.text },
  modalClose: { ...typography.h3, color: colors.textSecondary },
  sectionLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  lineItemForm: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  lineItemFormLabel: { ...typography.label, color: colors.text },
  productScroll: { maxHeight: 40 },
  productChip: {
    backgroundColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: spacing.xs,
  },
  productChipSelected: { backgroundColor: colors.primary },
  productChipText: { ...typography.caption, color: colors.textSecondary },
  productChipTextSelected: { color: '#fff', fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyLabel: { ...typography.caption, color: colors.textSecondary },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { ...typography.h3, color: colors.text },
  qtyValue: { ...typography.label, color: colors.text, minWidth: 24, textAlign: 'center' },
  removeItem: { ...typography.caption, color: colors.error, textDecorationLine: 'underline' },
  addItemBtn: {
    alignItems: 'center',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  addItemText: { ...typography.bodySmall, color: colors.primary },
  submitBtn: { marginBottom: spacing.lg },
});

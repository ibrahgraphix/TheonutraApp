//CheckoutScreen
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';

import { Button, Card, Input, OrderSummary, ShopHeader } from '../../components';
import type { ShopStackParamList } from '../../navigation/shopTypes';
import {
  getCompanyBankDetails,
  submitBankTransferOrder,
  submitMobileMoneyOrder,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import type { CompanyBankDetails, MobileMoneyProvider } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ShopStackParamList, 'Checkout'>;
type PaymentTab = 'bank_transfer' | 'mobile_money';

const bankSchema = z.object({
  reference: z.string().min(4, 'Enter your transaction reference or slip number'),
});

const mobileSchema = z.object({
  phone: z
    .string()
    .min(9, 'Enter a valid phone number')
    .regex(/^[+\d\s-]+$/, 'Invalid phone number format'),
});

const MOBILE_PROVIDERS: MobileMoneyProvider[] = ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Mixx by Yas', 'HaloPesa'];

export function CheckoutScreen() {
  const navigation = useNavigation<NavigationProp>();
  const distributor = useAuthStore((s) => s.distributor);
  const items = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);
  const getTotalPv = useCartStore((s) => s.getTotalPv);
  const clearCart = useCartStore((s) => s.clearCart);
  const currency = useCartStore((s) => s.getCurrency()) ?? 'USD';
  const total = getTotal();
  const totalPv = getTotalPv();

  const [activeTab, setActiveTab] = useState<PaymentTab>('bank_transfer');
  const [bankDetails, setBankDetails] = useState<CompanyBankDetails | null>(null);
  const [provider, setProvider] = useState<MobileMoneyProvider>('M-Pesa');
  const [submitting, setSubmitting] = useState(false);
  const [mobilePending, setMobilePending] = useState(false);

  const bankForm = useForm<z.infer<typeof bankSchema>>({
    resolver: zodResolver(bankSchema),
    defaultValues: { reference: '' },
  });

  const mobileForm = useForm<z.infer<typeof mobileSchema>>({
    resolver: zodResolver(mobileSchema),
    defaultValues: { phone: distributor?.phone ?? '' },
  });

  useEffect(() => {
    getCompanyBankDetails().then(setBankDetails);
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      navigation.replace('ShopList');
    }
  }, [items.length, navigation]);

  const handleBankSubmit = bankForm.handleSubmit(async (data) => {
    if (!distributor) return;
    setSubmitting(true);
    try {
      const order = await submitBankTransferOrder(
        distributor.id,
        distributor.countryId ?? distributor.country,
        items,
        data.reference,
      );
      clearCart();
      navigation.replace('OrderConfirmation', { orderId: order.id });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not submit your order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  });

  const handleMobileSubmit = mobileForm.handleSubmit(async (data) => {
    if (!distributor) return;
    setSubmitting(true);
    setMobilePending(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const order = await submitMobileMoneyOrder(
        distributor.id,
        distributor.countryId ?? distributor.country,
        items,
        provider,
        data.phone,
      );
      clearCart();
      navigation.replace('OrderConfirmation', { orderId: order.id });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not process payment request. Please try again.');
      setMobilePending(false);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Checkout" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <OrderSummary currency={currency} items={items} total={total} totalPv={totalPv} />

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setActiveTab('bank_transfer')}
            style={[styles.tab, activeTab === 'bank_transfer' && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'bank_transfer' && styles.tabTextActive,
              ]}
            >
              Bank Transfer
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('mobile_money')}
            style={[styles.tab, activeTab === 'mobile_money' && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'mobile_money' && styles.tabTextActive,
              ]}
            >
              Mobile Money
            </Text>
          </Pressable>
        </View>

        {activeTab === 'bank_transfer' ? (
          <Card>
            <Text style={styles.methodTitle}>Company Bank Details</Text>
            {bankDetails ? (
              <View style={styles.bankDetails}>
                <DetailRow label="Bank" value={bankDetails.bankName} />
                <DetailRow label="Account Name" value={bankDetails.accountName} />
                <DetailRow label="Account Number" value={bankDetails.accountNumber} />
                <DetailRow label="Branch Code" value={bankDetails.branchCode} />
                <DetailRow label="SWIFT" value={bankDetails.swiftCode} />
              </View>
            ) : null}

            <Text style={styles.instruction}>
              Transfer the total amount, then enter your transaction reference below.
            </Text>

            <Controller
              control={bankForm.control}
              name="reference"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={bankForm.formState.errors.reference?.message}
                  label="Transaction Reference / Slip Number"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="e.g. TXN-20260713-4821"
                  value={value}
                />
              )}
            />

            <Button
              fullWidth
              loading={submitting}
              onPress={handleBankSubmit}
              style={styles.submitButton}
              title="I've Made the Payment"
            />
          </Card>
        ) : (
          <Card>
            <Text style={styles.methodTitle}>Mobile Money Payment</Text>
            <Text style={styles.instruction}>
              Select your provider and enter your phone number to receive a payment prompt.
            </Text>

            <Text style={styles.fieldLabel}>Provider</Text>
            <View style={styles.providers}>
              {MOBILE_PROVIDERS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setProvider(p)}
                  style={[styles.providerChip, provider === p && styles.providerChipActive]}
                >
                  <Text
                    style={[
                      styles.providerText,
                      provider === p && styles.providerTextActive,
                    ]}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Controller
              control={mobileForm.control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={mobileForm.formState.errors.phone?.message}
                  keyboardType="phone-pad"
                  label="Phone Number"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="+254 712 345 678"
                  value={value}
                />
              )}
            />

            {mobilePending ? (
              <View style={styles.pendingBanner}>
                <Text style={styles.pendingText}>
                  Payment prompt sent — awaiting confirmation on your device…
                </Text>
              </View>
            ) : null}

            <Button
              fullWidth
              loading={submitting}
              onPress={handleMobileSubmit}
              style={styles.submitButton}
              title="Request Payment Prompt"
              variant="secondary"
            />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.md,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.textOnPrimary,
  },
  methodTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  bankDetails: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  instruction: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  providers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  providerChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  providerChipActive: {
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondary,
  },
  providerText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  providerTextActive: {
    color: colors.textOnSecondary,
  },
  pendingBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  pendingText: {
    ...typography.bodySmall,
    color: colors.warning,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: spacing.md,
  },
});

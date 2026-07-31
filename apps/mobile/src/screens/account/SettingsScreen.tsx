import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { Avatar, Button, Card, Input, ShopHeader } from '../../components';
import {
  changePassword,
  changePhone,
  deleteAccount,
  getPaymentMethod,
  updatePaymentMethod,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography } from '../../theme';
import type { AccountStackParamList } from '../../navigation/accountTypes';

type NavigationProp = NativeStackNavigationProp<AccountStackParamList, 'Settings'>;

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Required'),
    newPassword: z.string().min(6, 'At least 6 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

const phoneSchema = z.object({
  phone: z.string().min(9, 'Enter a valid phone number'),
});

const paymentMethodSchema = z.object({
  paymentMethod: z.string().min(1, 'Required'),
  paymentFullName: z.string().min(1, 'Required'),
  paymentAccountNumber: z.string().min(1, 'Required'),
});

type PaymentMethodFormData = z.infer<typeof paymentMethodSchema>;

const PAYMENT_METHODS = [
  { id: 'mpesa', name: 'M-Pesa' },
  { id: 'airtel_money', name: 'Airtel Money' },
  { id: 'mixx', name: 'Mixx by Yas' },
  { id: 'halopesa', name: 'HaloPesa' },
  { id: 'bank_transfer', name: 'Bank Transfer' },
];

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const distributor = useAuthStore((s) => s.distributor);
  const logout = useAuthStore((s) => s.logout);
  const updateDistributor = useAuthStore((s) => s.updateDistributor);

  const [passwordModal, setPasswordModal] = useState(false);
  const [phoneModal, setPhoneModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [paymentMethodModal, setPaymentMethodModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(false);

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: '', newPassword: '', confirm: '' },
  });

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: distributor?.phone ?? '' },
  });

  const paymentMethodForm = useForm<PaymentMethodFormData>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      paymentMethod: distributor?.payment_method || 'mpesa',
      paymentFullName: distributor?.payment_full_name || '',
      paymentAccountNumber: distributor?.payment_account_number || '',
    },
  });

  const loadPaymentMethod = useCallback(async () => {
    if (!distributor) return;
    setLoadingPaymentMethod(true);
    try {
      const data = await getPaymentMethod();
      paymentMethodForm.reset({
        paymentMethod: data.payment_method || 'mpesa',
        paymentFullName: data.payment_full_name || '',
        paymentAccountNumber: data.payment_account_number || '',
      });
      // Update local distributor state
      updateDistributor({
        ...distributor,
        payment_method: data.payment_method,
        payment_full_name: data.payment_full_name,
        payment_account_number: data.payment_account_number,
      });
    } catch (e) {
      // If payment method not set yet, that's okay - just use defaults
      console.log('No payment method set yet');
    } finally {
      setLoadingPaymentMethod(false);
    }
  }, [distributor, paymentMethodForm, updateDistributor]);

  useEffect(() => {
    loadPaymentMethod();
  }, [loadPaymentMethod]);

  const handlePasswordChange = passwordForm.handleSubmit(async (data) => {
    if (!distributor) return;
    setSubmitting(true);
    setSettingsError(null);
    try {
      await changePassword(distributor.id, data.current, data.newPassword);
      setPasswordModal(false);
      passwordForm.reset();
      Alert.alert('Success', 'Password changed successfully');
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  });

  const handlePhoneChange = phoneForm.handleSubmit(async (data) => {
    if (!distributor) return;
    setSubmitting(true);
    try {
      const updated = await changePhone(distributor.id, data.phone);
      updateDistributor(updated);
      setPhoneModal(false);
      Alert.alert('Success', 'Phone number updated successfully');
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  });

  const handlePaymentMethodSave = paymentMethodForm.handleSubmit(async (data) => {
    if (!distributor) return;
    setSubmitting(true);
    setSettingsError(null);
    try {
      await updatePaymentMethod(data);
      // Update the local distributor state with the new payment method
      updateDistributor({
        ...distributor,
        payment_method: data.paymentMethod,
        payment_full_name: data.paymentFullName,
        payment_account_number: data.paymentAccountNumber,
      });
      setPaymentMethodModal(false);
      Alert.alert('Success', 'Payment method saved successfully');
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  });

  const handleDelete = async () => {
    if (!distributor) return;
    setSubmitting(true);
    try {
      await deleteAccount(distributor.id);
      setDeleteModal(false);
      logout();
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!distributor) return null;

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Settings" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <Card style={styles.profileCard}>
          <Avatar name={distributor.fullName} size={56} />
          <Text style={styles.name}>{distributor.fullName}</Text>
          <Text style={styles.phone}>{distributor.phone}</Text>
        </Card>

        {/* Payment Method */}
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <Card style={styles.card}>
          <TouchableOpacity
            onPress={() => setPaymentMethodModal(true)}
            style={styles.row}
          >
            <View>
              <Text style={styles.rowLabel}>Payment Method</Text>
              <Text style={styles.rowValue}>
                {loadingPaymentMethod ? (
                  'Loading...'
                ) : distributor.payment_method ? (
                  PAYMENT_METHODS.find(m => m.id === distributor.payment_method)?.name || distributor.payment_method
                ) : (
                  'Not set'
                )}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </Card>

        {/* Account Settings */}
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <Card style={styles.card}>
          <TouchableOpacity
            onPress={() => setPasswordModal(true)}
            style={styles.row}
          >
            <Text style={styles.rowLabel}>Change Password</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPhoneModal(true)}
            style={styles.row}
          >
            <Text style={styles.rowLabel}>Change Mobile Number</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </Card>

        {/* Danger Zone */}
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <Card style={styles.card}>
          <TouchableOpacity
            onPress={() => setDeleteModal(true)}
            style={styles.row}
          >
            <Text style={[styles.rowLabel, styles.danger]}>Delete Account</Text>
            <Text style={[styles.chevron, styles.danger]}>›</Text>
          </TouchableOpacity>
        </Card>

        <Button onPress={logout} style={styles.logoutBtn} title="Sign Out" variant="outline" />
      </ScrollView>

      {/* Password Modal */}
      <Modal animationType="slide" transparent visible={passwordModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ShopHeader title="Change Password" />
            <Controller
              control={passwordForm.control}
              name="current"
              render={({ field: { onChange, value } }) => (
                <Input
                  error={passwordForm.formState.errors.current?.message}
                  label="Current Password"
                  onChangeText={onChange}
                  secureTextEntry
                  value={value}
                />
              )}
            />
            <Controller
              control={passwordForm.control}
              name="newPassword"
              render={({ field: { onChange, value } }) => (
                <Input
                  error={passwordForm.formState.errors.newPassword?.message}
                  label="New Password"
                  onChangeText={onChange}
                  secureTextEntry
                  value={value}
                />
              )}
            />
            <Controller
              control={passwordForm.control}
              name="confirm"
              render={({ field: { onChange, value } }) => (
                <Input
                  error={passwordForm.formState.errors.confirm?.message}
                  label="Confirm New Password"
                  onChangeText={onChange}
                  secureTextEntry
                  value={value}
                />
              )}
            />
            {settingsError && <Text style={styles.error}>{settingsError}</Text>}
            <Button
              loading={submitting}
              onPress={handlePasswordChange}
              style={styles.modalBtn}
              title="Change Password"
            />
            <Button
              onPress={() => {
                setPasswordModal(false);
                passwordForm.reset();
                setSettingsError(null);
              }}
              style={styles.modalBtn}
              title="Cancel"
              variant="outline"
            />
          </View>
        </View>
      </Modal>

      {/* Phone Modal */}
      <Modal animationType="slide" transparent visible={phoneModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ShopHeader title="Change Mobile Number" />
            <Controller
              control={phoneForm.control}
              name="phone"
              render={({ field: { onChange, value } }) => (
                <Input
                  error={phoneForm.formState.errors.phone?.message}
                  label="Mobile Number"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {settingsError && <Text style={styles.error}>{settingsError}</Text>}
            <Button
              loading={submitting}
              onPress={handlePhoneChange}
              style={styles.modalBtn}
              title="Update Phone"
            />
            <Button
              onPress={() => {
                setPhoneModal(false);
                setSettingsError(null);
              }}
              style={styles.modalBtn}
              title="Cancel"
              variant="outline"
            />
          </View>
        </View>
      </Modal>

      {/* Payment Method Modal */}
      <Modal animationType="slide" transparent visible={paymentMethodModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ShopHeader title="Payment Method" />
            <Controller
              control={paymentMethodForm.control}
              name="paymentMethod"
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text style={styles.label}>Payment Provider</Text>
                  <View style={styles.providerContainer}>
                    {PAYMENT_METHODS.map((method) => (
                      <TouchableOpacity
                        key={method.id}
                        onPress={() => onChange(method.id)}
                        style={[
                          styles.providerBtn,
                          value === method.id && styles.providerBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.providerText,
                            value === method.id && styles.providerTextActive,
                          ]}
                        >
                          {method.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            />
            <Controller
              control={paymentMethodForm.control}
              name="paymentFullName"
              render={({ field: { onChange, value } }) => (
                <Input
                  error={paymentMethodForm.formState.errors.paymentFullName?.message}
                  label="Full Name"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            <Controller
              control={paymentMethodForm.control}
              name="paymentAccountNumber"
              render={({ field: { onChange, value } }) => (
                <Input
                  error={paymentMethodForm.formState.errors.paymentAccountNumber?.message}
                  label="Phone Number / Bank Account"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {settingsError && <Text style={styles.error}>{settingsError}</Text>}
            <Button
              loading={submitting}
              onPress={handlePaymentMethodSave}
              style={styles.modalBtn}
              title="Save Payment Method"
            />
            <Button
              onPress={() => {
                setPaymentMethodModal(false);
                setSettingsError(null);
              }}
              style={styles.modalBtn}
              title="Cancel"
              variant="outline"
            />
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal animationType="slide" transparent visible={deleteModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ShopHeader title="Delete Account" />
            <Text style={styles.warningText}>
              Are you sure you want to delete your account? This action cannot be undone.
            </Text>
            {settingsError && <Text style={styles.error}>{settingsError}</Text>}
            <Button
              loading={submitting}
              onPress={handleDelete}
              style={[styles.modalBtn, styles.dangerBtn]}
              title="Delete Account"
            />
            <Button
              onPress={() => {
                setDeleteModal(false);
                setSettingsError(null);
              }}
              style={styles.modalBtn}
              title="Cancel"
              variant="outline"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  profileCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  name: { ...typography.h3, color: colors.text },
  phone: { ...typography.body, color: colors.textSecondary },
  sectionTitle: {
    ...typography.h6,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  card: { gap: 0 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...typography.body, color: colors.text },
  rowValue: { ...typography.caption, color: colors.textSecondary },
  chevron: { ...typography.h3, color: colors.textSecondary },
  danger: { color: colors.error },
  logoutBtn: { marginTop: spacing.xl },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: spacing.xl,
    borderTopRightRadius: spacing.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxHeight: '90%',
  },
  modalBtn: { marginTop: spacing.md },
  dangerBtn: { backgroundColor: colors.error },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.sm },
  warningText: { ...typography.body, color: colors.text, marginBottom: spacing.lg },
  label: { ...typography.body, color: colors.text, marginBottom: spacing.sm },
  providerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  providerBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  providerBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  providerText: { ...typography.caption, color: colors.text },
  providerTextActive: { color: colors.primary },
});
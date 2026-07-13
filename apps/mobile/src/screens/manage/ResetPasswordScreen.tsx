import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { resetSellerPassword } from '../../services/api';
import { colors, radius, spacing, typography } from '../../theme';

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm the password'),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match.',
        path: ['confirmPassword'],
      });
    }
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ResetPassword'>;
type RouteProps = NativeStackScreenProps<ManageStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps['route']>();
  const distributorId = route.params?.distributorId ?? '';
  const distributorName = route.params?.distributorName ?? 'seller';
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    setSubmitError(null);
    setLoading(true);

    try {
      await resetSellerPassword(distributorId, data.password);
      setCreatedPassword(data.password);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const copyValue = async (value: string) => {
    await Clipboard.setStringAsync(value);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ShopHeader onBack={() => navigation.goBack()} title="Reset Password" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Set a new temporary password</Text>
            <Text style={styles.subtitle}>For {distributorName}</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={errors.password?.message}
                  label="New password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Create a new password"
                  secureTextEntry
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={errors.confirmPassword?.message}
                  label="Confirm password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Re-enter password"
                  secureTextEntry
                  value={value}
                />
              )}
            />

            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

            <Button fullWidth loading={loading} onPress={handleSubmit(onSubmit)} title="Save Password" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal animationType="fade" transparent visible={Boolean(createdPassword)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>Password reset complete</Text>
            <Text style={styles.modalBody}>Share this password with the seller directly.</Text>

            <View style={styles.credentialRow}>
              <Text style={styles.credentialValue}>{createdPassword}</Text>
              <Pressable onPress={() => createdPassword && copyValue(createdPassword)}>
                <Text style={styles.copyText}>Copy</Text>
              </Pressable>
            </View>

            <Button onPress={() => setCreatedPassword(null)} title="Close" variant="secondary" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    gap: spacing.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.lg,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
  credentialRow: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  credentialValue: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  copyText: {
    ...typography.label,
    color: colors.primary,
  },
});

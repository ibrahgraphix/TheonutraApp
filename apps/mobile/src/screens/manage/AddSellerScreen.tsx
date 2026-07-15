import * as Clipboard from 'expo-clipboard';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { createSellerAccount, getCountries, searchDistributors } from '../../services/api';
import type { Country, Distributor } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

const createSellerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the seller full name'),
    phone: z.string().trim().min(6, 'Enter a phone number'),
    countryId: z.string().min(1, 'Choose a country'),
    referredBy: z.string().optional().nullable(),
    distributorId: z.string().trim().min(3, 'Enter a Distributor ID'),
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

type CreateSellerForm = z.infer<typeof createSellerSchema>;
type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'AddSeller'>;

export function AddSellerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [countries, setCountries] = useState<Country[]>([]);
  const [allDistributors, setAllDistributors] = useState<Distributor[]>([]);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [recruiterModalOpen, setRecruiterModalOpen] = useState(false);
  const [recruiterSearch, setRecruiterSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    distributorId: string;
    password: string;
  } | null>(null);

  const {
    control,
    handleSubmit,
    clearErrors,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateSellerForm>({
    resolver: zodResolver(createSellerSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      countryId: '',
      referredBy: '',
      distributorId: '',
      password: '',
      confirmPassword: '',
    },
  });

  const selectedCountryId = watch('countryId');
  const selectedRecruiterId = watch('referredBy');
  const distributorIdValue = watch('distributorId');
  const passwordValue = watch('password');
  const confirmPasswordValue = watch('confirmPassword');
  const selectedCountryLabel =
    countries.find((c) => c.id === selectedCountryId)?.name ?? 'Select country';

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [countryOptions, distributors] = await Promise.all([
          getCountries(),
          searchDistributors(''),
        ]);
        setCountries(countryOptions);
        setAllDistributors(distributors);
        if (!countryOptions.length) return;
        if (!selectedCountryId) {
          setValue('countryId', countryOptions[0].id, { shouldValidate: true });
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to load form options.');
      }
    };

    void loadOptions();
  }, [selectedCountryId, setValue]);
  useEffect(() => {
    const normalized = distributorIdValue.trim().toUpperCase();
    if (!normalized) {
      clearErrors('distributorId');
      return;
    }

    const exists = allDistributors.some(
      (item) => item.distributorId.toUpperCase() === normalized,
    );

    if (exists) {
      setError('distributorId', {
        type: 'manual',
        message: 'Distributor ID already exists.',
      });
    } else {
      clearErrors('distributorId');
    }
  }, [allDistributors, clearErrors, distributorIdValue, setError]);

  useEffect(() => {
    if (!confirmPasswordValue) {
      clearErrors('confirmPassword');
      return;
    }

    if (passwordValue !== confirmPasswordValue) {
      setError('confirmPassword', {
        type: 'manual',
        message: 'Passwords do not match.',
      });
    } else {
      clearErrors('confirmPassword');
    }
  }, [clearErrors, confirmPasswordValue, passwordValue, setError]);

  const recruiterLabel =
    selectedRecruiterId && selectedRecruiterId.trim()
      ? allDistributors.find((item) => item.id === selectedRecruiterId)?.fullName ?? 'Select recruiter'
      : 'No recruiter (top-level)';

  const filteredRecruiters = recruiterSearch.trim()
    ? allDistributors.filter((item) => {
        const search = recruiterSearch.toLowerCase();
        return (
          item.fullName.toLowerCase().includes(search) ||
          item.distributorId.toLowerCase().includes(search) ||
          item.country.toLowerCase().includes(search)
        );
      })
    : allDistributors;

  const onSubmit = async (data: CreateSellerForm) => {
    setSubmitError(null);
    setLoading(true);

    try {
      const created = await createSellerAccount({
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        country: data.countryId,
        referredBy: data.referredBy?.trim() ? data.referredBy : null,
        distributorId: data.distributorId.trim().toUpperCase(),
        password: data.password,
      });

      setCreatedCredentials({
        distributorId: created.distributorId,
        password: data.password,
      });
      setAllDistributors((current) => [...current, created]);
      setValue('fullName', '');
      setValue('phone', '');
      setValue('countryId', countries[0]?.id ?? '', { shouldValidate: true });
      setValue('referredBy', '', { shouldValidate: true });
      setValue('distributorId', '');
      setValue('password', '');
      setValue('confirmPassword', '');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create seller.');
    } finally {
      setLoading(false);
    }
  };

  const copyValue = async (value: string) => {
    await Clipboard.setStringAsync(value);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ShopHeader onBack={() => navigation.goBack()} title="Add Seller" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Create a new seller account</Text>
            <Text style={styles.subtitle}>
              Staff members can create distributor accounts directly here.
            </Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={errors.fullName?.message}
                  label="Full name"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="e.g. Amina Yusuf"
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={errors.phone?.message}
                  label="Phone number"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="e.g. +234 801 000 0000"
                  value={value}
                />
              )}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Country</Text>
              <Pressable
                onPress={() => setCountryModalOpen(true)}
                style={styles.selectTrigger}
              >
                <Text style={styles.selectText}>{selectedCountryLabel}</Text>
                <Text style={styles.chevron}>▼</Text>
              </Pressable>
              {errors.countryId?.message ? (
                <Text style={styles.error}>{errors.countryId.message}</Text>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Referred by</Text>
              <Pressable
                onPress={() => setRecruiterModalOpen(true)}
                style={styles.selectTrigger}
              >
                <Text style={styles.selectText}>{recruiterLabel}</Text>
                <Text style={styles.chevron}>▼</Text>
              </Pressable>
            </View>

            <Controller
              control={control}
              name="distributorId"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={errors.distributorId?.message}
                  hint="Use a unique Distributor ID"
                  label="Distributor ID"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="e.g. BF-TZ-00231"
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={errors.password?.message}
                  label="Password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Create a temporary password"
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

            <Button
              fullWidth
              loading={loading}
              onPress={handleSubmit(onSubmit)}
              title="Create Seller"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal animationType="fade" transparent visible={countryModalOpen}>
        <Pressable onPress={() => setCountryModalOpen(false)} style={styles.modalOverlay}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select country</Text>
            {countries.length === 0 ? (
              <Text style={styles.optionSubText}>
                No countries in the database yet. Add one under Manage → Countries.
              </Text>
            ) : (
              countries.map((country) => (
                <Pressable
                  key={country.id}
                  onPress={() => {
                    setValue('countryId', country.id, { shouldValidate: true });
                    setCountryModalOpen(false);
                  }}
                  style={styles.optionRow}
                >
                  <Text style={styles.optionText}>{country.name}</Text>
                  <Text style={styles.optionSubText}>
                    {country.isoCode} · {country.currencyCode}
                  </Text>
                </Pressable>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={recruiterModalOpen}>
        <Pressable onPress={() => setRecruiterModalOpen(false)} style={styles.modalOverlay}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select recruiter</Text>
            <TextInput
              onChangeText={setRecruiterSearch}
              placeholder="Search seller name or ID"
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              value={recruiterSearch}
            />
            <Pressable
              onPress={() => {
                setValue('referredBy', '', { shouldValidate: true });
                setRecruiterModalOpen(false);
              }}
              style={styles.optionRow}
            >
              <Text style={styles.optionText}>No recruiter (top-level)</Text>
            </Pressable>
            {filteredRecruiters.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setValue('referredBy', item.id, { shouldValidate: true });
                  setRecruiterModalOpen(false);
                }}
                style={styles.optionRow}
              >
                <Text style={styles.optionText}>{item.fullName}</Text>
                <Text style={styles.optionSubText}>{item.distributorId}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={Boolean(createdCredentials)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>Seller account created</Text>
            <Text style={styles.modalBody}>
              Share these credentials with the seller directly.
            </Text>

            <View style={styles.credentialBlock}>
              <Text style={styles.credentialLabel}>Distributor ID</Text>
              <View style={styles.credentialRow}>
                <Text style={styles.credentialValue}>{createdCredentials?.distributorId}</Text>
                <Pressable onPress={() => createdCredentials && copyValue(createdCredentials.distributorId)}>
                  <Text style={styles.copyText}>Copy</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.credentialBlock}>
              <Text style={styles.credentialLabel}>Temporary password</Text>
              <View style={styles.credentialRow}>
                <Text style={styles.credentialValue}>{createdCredentials?.password}</Text>
                <Pressable onPress={() => createdCredentials && copyValue(createdCredentials.password)}>
                  <Text style={styles.copyText}>Copy</Text>
                </Pressable>
              </View>
            </View>

            <Button onPress={() => setCreatedCredentials(null)} title="Close" variant="secondary" />
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
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  selectTrigger: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  selectText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  chevron: {
    color: colors.textSecondary,
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
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.lg,
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
  searchInput: {
    ...typography.body,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionRow: {
    borderRadius: radius.md,
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
  },
  optionSubText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
  },
  credentialBlock: {
    gap: spacing.sm,
  },
  credentialLabel: {
    ...typography.label,
    color: colors.text,
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

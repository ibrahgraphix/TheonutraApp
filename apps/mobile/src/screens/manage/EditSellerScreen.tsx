import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button, CountryPicker, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { getCountries, getDistributorById, updateSeller } from '../../services/api';
import type { Country } from '../../types';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'EditSeller'>;
type ScreenRoute = RouteProp<ManageStackParamList, 'EditSeller'>;

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter a name'),
  phone: z.string().trim().min(9, 'Enter a valid phone number'),
  country: z.string().min(1, 'Select a country'),
});

type FormValues = z.infer<typeof schema>;

export function EditSellerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const { distributorId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', phone: '', country: '' },
  });

  useEffect(() => {
    Promise.all([getDistributorById(distributorId), getCountries()]).then(([dist, countryList]) => {
      setCountries(countryList);
      if (dist) {
        reset({
          fullName: dist.fullName,
          phone: dist.phone,
          country: dist.countryId ?? dist.country,
        });
      }
      setLoading(false);
    });
  }, [distributorId, reset]);

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    setSaving(true);
    try {
      await updateSeller(distributorId, {
        fullName: data.fullName.trim(),
        phoneNumber: data.phone.trim(),
        countryId: data.country,
      });
      Alert.alert('Saved', 'Distributor updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to update distributor.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ShopHeader onBack={() => navigation.goBack()} title="Edit Distributor" />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ShopHeader onBack={() => navigation.goBack()} title="Edit Distributor" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input error={errors.fullName?.message} label="Full name" onBlur={onBlur} onChangeText={onChange} value={value} />
              )}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={errors.phone?.message}
                  keyboardType="phone-pad"
                  label="Phone number"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="country"
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text style={styles.label}>Country</Text>
                  <CountryPicker
                    countries={countries.map((c) => c.name)}
                    onSelect={(name) => {
                      const match = countries.find((c) => c.name === name);
                      onChange(match?.id ?? name);
                    }}
                    selected={countries.find((c) => c.id === value)?.name ?? value}
                  />
                  {errors.country ? <Text style={styles.error}>{errors.country.message}</Text> : null}
                </View>
              )}
            />
            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
            <Button fullWidth loading={saving} onPress={handleSubmit(onSubmit)} title="Save Changes" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loader: { marginTop: spacing.xxxl },
  container: { flexGrow: 1, gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxxl },
  form: { gap: spacing.lg },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.xs },
  error: { ...typography.caption, color: colors.error },
});
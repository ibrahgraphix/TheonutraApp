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

import { Button, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { getCountries, updateCountry } from '../../services/api';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'EditCountry'>;
type ScreenRoute = RouteProp<ManageStackParamList, 'EditCountry'>;

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the country name'),
  isoCode: z.string().trim().min(2, 'ISO code must be 2–3 letters').max(3, 'ISO code must be 2–3 letters'),
  currencyCode: z.string().trim().length(3, 'Currency code must be exactly 3 letters'),
});

type FormValues = z.infer<typeof schema>;

export function EditCountryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const { countryId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', isoCode: '', currencyCode: '' },
  });

  useEffect(() => {
    getCountries()
      .then((countries) => {
        const country = countries.find((c) => c.id === countryId);
        if (country) {
          reset({
            name: country.name,
            isoCode: country.isoCode,
            currencyCode: country.currencyCode,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [countryId, reset]);

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    setSaving(true);
    try {
      await updateCountry(countryId, {
        name: data.name.trim(),
        isoCode: data.isoCode.trim().toUpperCase(),
        currencyCode: data.currencyCode.trim().toUpperCase(),
      });
      Alert.alert('Saved', 'Country updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to update country.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ShopHeader onBack={() => navigation.goBack()} title="Edit Country" />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ShopHeader onBack={() => navigation.goBack()} title="Edit Country" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input error={errors.name?.message} label="Country name" onBlur={onBlur} onChangeText={onChange} value={value} />
              )}
            />
            <Controller
              control={control}
              name="isoCode"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={errors.isoCode?.message}
                  label="ISO code"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="currencyCode"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={errors.currencyCode?.message}
                  label="Currency code"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
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
  error: { ...typography.caption, color: colors.error },
});
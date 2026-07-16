//AddCountryScreen
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { createCountry } from '../../services/api';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'AddCountry'>;

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the country name'),
  isoCode: z
    .string()
    .trim()
    .min(2, 'ISO code must be 2–3 letters')
    .max(3, 'ISO code must be 2–3 letters'),
  currencyCode: z
    .string()
    .trim()
    .length(3, 'Currency code must be exactly 3 letters'),
});

type FormValues = z.infer<typeof schema>;

export function AddCountryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      isoCode: '',
      currencyCode: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitError(null);
    setLoading(true);
    try {
      const created = await createCountry({
        name: data.name.trim(),
        isoCode: data.isoCode.trim().toUpperCase(),
        currencyCode: data.currencyCode.trim().toUpperCase(),
      });
      Alert.alert('Country added', `${created.name} (${created.isoCode}) is now available.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to create country.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ShopHeader onBack={() => navigation.goBack()} title="Add Country" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Add a market country</Text>
            <Text style={styles.subtitle}>
              New countries are saved to the database and appear in seller creation and the shop.
            </Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={errors.name?.message}
                  label="Country name"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="e.g. Kenya"
                  value={value}
                />
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
                  hint="Two-letter ISO code preferred (e.g. KE)"
                  label="ISO code"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="e.g. KE"
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
                  placeholder="e.g. KES"
                  value={value}
                />
              )}
            />

            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

            <Button fullWidth loading={loading} onPress={handleSubmit(onSubmit)} title="Save Country" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
});

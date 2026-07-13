import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
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

import { Button, Input, LogoHeader } from '../../components';
import type { AuthStackParamList } from '../../navigation/types';
import { requestPasswordReset } from '../../services/api';
import { colors, spacing, typography } from '../../theme';

const forgotSchema = z.object({
  distributorId: z.string().min(3, 'Enter your Distributor ID'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { distributorId: '' },
  });

  const onSubmit = async (data: ForgotForm) => {
    setIsLoading(true);
    setError(null);
    try {
      await requestPasswordReset(data.distributorId);
      Alert.alert(
        'Reset link sent',
        'If an account exists for this Distributor ID, password reset instructions have been sent to the registered email.',
        [{ text: 'Back to Login', onPress: () => navigation.navigate('Login') }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <LogoHeader height={80} />

          <View style={styles.header}>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your Distributor ID and we&apos;ll send reset instructions to your
              registered email.
            </Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="distributorId"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={errors.distributorId?.message}
                  label="Distributor ID"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="e.g. TN004"
                  value={value}
                />
              )}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              fullWidth
              loading={isLoading}
              onPress={handleSubmit(onSubmit)}
              title="Send Reset Link"
            />

            <Button
              fullWidth
              onPress={() => navigation.goBack()}
              title="Back to Login"
              variant="outline"
            />
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
    padding: spacing.xxl,
    gap: spacing.xxl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
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
    ...typography.bodySmall,
    color: colors.error,
  },
});

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
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
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, typography } from '../../theme';

const loginSchema = z.object({
  distributorId: z.string().min(3, 'Enter your Distributor ID'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      distributorId: 'TN004',
      password: 'password123',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setSubmitError(null);
    try {
      await login(data.distributorId, data.password);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Login failed.');
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
          <LogoHeader height={100} />

          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in with your Distributor ID to access your dashboard.
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

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  error={errors.password?.message}
                  label="Password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Enter your password"
                  secureTextEntry
                  value={value}
                />
              )}
            />

            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

            <Button
              fullWidth
              loading={isLoading}
              onPress={handleSubmit(onSubmit)}
              title="Sign In"
            />

            <Text style={styles.forgotHint}>Forgot your password? Contact your admin.</Text>
          </View>

          <Text style={styles.demoHint}>
            Demo: TN004 / password123{'\n'}
            Admin: TN001 / password123 · Staff: TN002 / password123
          </Text>
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
  demoHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  forgotHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

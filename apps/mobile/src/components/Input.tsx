import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, style, ...props }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

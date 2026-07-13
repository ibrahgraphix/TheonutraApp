import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
}: QuantitySelectorProps) {
  const decrease = () => {
    if (value > min) onChange(value - 1);
  };

  const increase = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel="Decrease quantity"
        accessibilityRole="button"
        disabled={value <= min}
        onPress={decrease}
        style={({ pressed }) => [
          styles.button,
          value <= min && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        accessibilityLabel="Increase quantity"
        accessibilityRole="button"
        disabled={value >= max}
        onPress={increase}
        style={({ pressed }) => [
          styles.button,
          value >= max && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  value: {
    ...typography.h3,
    color: colors.text,
    minWidth: 32,
    textAlign: 'center',
  },
});

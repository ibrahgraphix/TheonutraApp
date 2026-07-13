import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

interface CountryPickerProps {
  countries: string[];
  selected: string;
  registeredCountry?: string;
  onSelect: (country: string) => void;
}

export function CountryPicker({
  countries,
  selected,
  registeredCountry,
  onSelect,
}: CountryPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Text style={styles.triggerLabel}>Browse as</Text>
        <View style={styles.triggerValue}>
          <Text style={styles.triggerText}>{selected}</Text>
          <Text style={styles.chevron}>▼</Text>
        </View>
        {registeredCountry && selected !== registeredCountry ? (
          <Text style={styles.hint}>Your profile: {registeredCountry}</Text>
        ) : null}
      </Pressable>

      <Modal animationType="fade" transparent visible={open}>
        <Pressable onPress={() => setOpen(false)} style={styles.overlay}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select country</Text>
            <ScrollView style={styles.list}>
              {countries.map((country) => {
                const active = country === selected;
                return (
                  <Pressable
                    key={country}
                    onPress={() => {
                      onSelect(country);
                      setOpen(false);
                    }}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {country}
                      {country === registeredCountry ? ' (your country)' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  triggerPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  triggerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  triggerValue: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  triggerText: {
    ...typography.label,
    color: colors.primary,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  hint: {
    ...typography.caption,
    color: colors.secondary,
  },
  overlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
    padding: spacing.lg,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  list: {
    marginBottom: spacing.md,
  },
  option: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionActive: {
    backgroundColor: colors.surfaceMuted,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelText: {
    ...typography.label,
    color: colors.textSecondary,
  },
});

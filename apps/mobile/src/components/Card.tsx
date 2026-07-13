import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, spacing } from '../theme';

interface CardProps extends ViewProps {
  padded?: boolean;
  elevated?: boolean;
}

export function Card({
  children,
  padded = true,
  elevated = true,
  style,
  ...props
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        elevated && styles.elevated,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  padded: {
    padding: spacing.lg,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});

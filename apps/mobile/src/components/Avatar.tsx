import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../theme';

interface AvatarProps {
  name: string;
  size?: number;
  imageUrl?: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, size = 48, imageUrl }: AvatarProps) {
  if (imageUrl) {
    return (
      <Image
        accessibilityLabel={name}
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colors.secondary }}
      />
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  initials: {
    ...typography.label,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});

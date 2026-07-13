import { StyleSheet, Text, View } from 'react-native';

import { getCoverStyle } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';

interface CoverImageProps {
  imageUrl?: string;
  height?: number;
}

export function CoverImage({ imageUrl, height = 200 }: CoverImageProps) {
  const cover = getCoverStyle(imageUrl);

  return (
    <View style={[styles.cover, { backgroundColor: cover.color, height }]}>
      <Text style={styles.emoji}>{cover.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    alignItems: 'center',
    borderRadius: radius.lg,
    justifyContent: 'center',
    width: '100%',
  },
  emoji: {
    fontSize: 64,
  },
});

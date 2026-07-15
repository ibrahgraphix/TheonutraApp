import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { getCoverStyle } from '../utils/format';
import { radius } from '../theme';

interface CoverImageProps {
  imageUrl?: string;
  height?: number;
}

export function CoverImage({ imageUrl, height = 200 }: CoverImageProps) {
  const isRemote = Boolean(imageUrl?.startsWith('http'));

  if (isRemote) {
    return (
      <Image
        contentFit="cover"
        source={{ uri: imageUrl }}
        style={[styles.remote, { height }]}
      />
    );
  }

  const cover = getCoverStyle(imageUrl);

  return (
    <View style={[styles.cover, { backgroundColor: cover.color, height }]}>
      <Text style={styles.emoji}>{cover.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  remote: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    width: '100%',
  },
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

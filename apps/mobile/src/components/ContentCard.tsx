import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getCoverStyle } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';
import { Card } from './Card';

interface ContentCardProps {
  title: string;
  excerpt: string;
  imageUrl?: string;
  meta?: string;
  onPress: () => void;
}

export function ContentCard({
  title,
  excerpt,
  imageUrl,
  meta,
  onPress,
}: ContentCardProps) {
  const cover = getCoverStyle(imageUrl);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card elevated padded={false} style={styles.card}>
        <View style={[styles.cover, { backgroundColor: cover.color }]}>
          <Text style={styles.coverEmoji}>{cover.emoji}</Text>
        </View>
        <View style={styles.content}>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          <Text numberOfLines={2} style={styles.excerpt}>
            {excerpt}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },
  card: {
    overflow: 'hidden',
  },
  cover: {
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 40,
  },
  content: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  meta: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '600',
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  excerpt: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});

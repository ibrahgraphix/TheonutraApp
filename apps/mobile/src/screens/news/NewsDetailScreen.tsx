import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CoverImage, ShopHeader } from '../../components';
import type { NewsStackParamList } from '../../navigation/newsTypes';
import { getNewsById } from '../../services/api';
import type { NewsPost } from '../../types';
import { formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<NewsStackParamList, 'NewsDetail'>;
type ScreenRoute = RouteProp<NewsStackParamList, 'NewsDetail'>;

export function NewsDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNewsById(route.params.newsId)
      .then(setPost)
      .finally(() => setLoading(false));
  }, [route.params.newsId]);

  return (
    <ScrollView style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="News" />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : !post ? (
        <Text style={styles.error}>Post not found.</Text>
      ) : (
        <View style={styles.content}>
          <CoverImage imageUrl={post.imageUrl} />
          <Text style={styles.date}>{formatDate(post.publishedAt)}</Text>
          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.body}>{post.content}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  error: { ...typography.body, color: colors.error, padding: spacing.xxl, textAlign: 'center' },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  date: { ...typography.caption, color: colors.secondary, fontWeight: '600' },
  title: { ...typography.h1, color: colors.text },
  body: { ...typography.body, color: colors.text, lineHeight: 26 },
});

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
import type { ArticlesStackParamList } from '../../navigation/articlesTypes';
import { getArticleById } from '../../services/api';
import type { Article } from '../../types';
import { formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ArticlesStackParamList, 'ArticleDetail'>;
type ScreenRoute = RouteProp<ArticlesStackParamList, 'ArticleDetail'>;

export function ArticleDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getArticleById(route.params.articleId)
      .then(setArticle)
      .finally(() => setLoading(false));
  }, [route.params.articleId]);

  return (
    <ScrollView style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Article" />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : !article ? (
        <Text style={styles.error}>Article not found.</Text>
      ) : (
        <View style={styles.content}>
          <CoverImage imageUrl={article.imageUrl} />
          <Text style={styles.category}>{article.category}</Text>
          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.meta}>
            {article.author} · {formatDate(article.publishedAt)}
          </Text>
          <Text style={styles.body}>{article.content}</Text>
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
  category: { ...typography.caption, color: colors.secondary, fontWeight: '600' },
  title: { ...typography.h1, color: colors.text },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  body: { ...typography.body, color: colors.text, lineHeight: 26 },
});

//articleList
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ContentCard, ShopHeader } from '../../components';
import type { ArticlesStackParamList } from '../../navigation/articlesTypes';
import { getArticles } from '../../services/api';
import type { Article } from '../../types';
import { formatDate } from '../../utils/format';
import { colors, spacing } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ArticlesStackParamList, 'ArticlesList'>;

export function ArticlesListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getArticles()
      .then(setArticles)
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        title="Articles"
      />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContentCard
              excerpt={item.summary}
              imageUrl={item.imageUrl}
              meta={`${item.category} · ${formatDate(item.publishedAt)}`}
              onPress={() => navigation.navigate('ArticleDetail', { articleId: item.id })}
              title={item.title}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  list: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
});

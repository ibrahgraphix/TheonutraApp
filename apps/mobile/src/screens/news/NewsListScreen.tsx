import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ContentCard, ShopHeader } from '../../components';
import type { NewsStackParamList } from '../../navigation/newsTypes';
import { getNews } from '../../services/api';
import type { NewsPost } from '../../types';
import { formatDate } from '../../utils/format';
import { colors, spacing } from '../../theme';

type NavigationProp = NativeStackNavigationProp<NewsStackParamList, 'NewsList'>;

export function NewsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNews()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        title="News"
      />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContentCard
              excerpt={item.excerpt}
              imageUrl={item.imageUrl}
              meta={formatDate(item.publishedAt)}
              onPress={() => navigation.navigate('NewsDetail', { newsId: item.id })}
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

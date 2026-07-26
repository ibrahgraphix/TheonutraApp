import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfirmModal, ContentCard, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { deleteNewsPost, getNews } from '../../services/api';
import type { NewsPost } from '../../types';
import { formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageNews'>;

export function ManageNewsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<NewsPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getNews()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteNewsPost(confirmTarget.id);
      setConfirmTarget(null);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete news.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={() => navigation.navigate('PostNews')} style={styles.headerAction}>
            <Text style={styles.headerActionText}>+ Add</Text>
          </Pressable>
        }
        title="Manage News"
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : posts.length === 0 ? (
        <Text style={styles.empty}>No news posts yet.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View>
              <ContentCard
                excerpt={item.excerpt}
                imageUrl={item.imageUrl}
                meta={formatDate(item.publishedAt)}
                onPress={() => navigation.navigate('EditNews', { newsId: item.id })}
                title={item.title}
              />
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => navigation.navigate('EditNews', { newsId: item.id })}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => setConfirmTarget(item)} style={styles.actionBtn}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <ConfirmModal
        confirmLabel="Delete Forever"
        destructive
        loading={deleting}
        message={`Permanently delete "${confirmTarget?.title ?? ''}"? This also removes its cover image from Cloudinary.`}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleDelete}
        title="Delete News?"
        visible={confirmTarget !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  empty: { ...typography.body, color: colors.textSecondary, padding: spacing.xxl, textAlign: 'center' },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  headerAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  headerActionText: { ...typography.label, color: colors.textOnPrimary },
  actionRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end', marginTop: spacing.xs },
  actionBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  actionText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  deleteText: { ...typography.caption, color: colors.error, fontWeight: '600' },
});
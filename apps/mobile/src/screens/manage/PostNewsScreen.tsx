import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, Card, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { createNewsPost } from '../../services/api';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'PostNews'>;

const schema = z.object({
  title: z.string().min(5, 'Title required'),
  excerpt: z.string().min(10, 'Excerpt required'),
  content: z.string().min(20, 'Body required'),
});

export function PostNewsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', excerpt: '', content: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true);
    try {
      await createNewsPost({
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        imageUrl: 'cover-green',
      });
      Alert.alert('Published', 'News post published to all distributors.');
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not publish news.');
    } finally {
      setSaving(false);
    }
  });

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Post News" />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.imagePlaceholder}>
          <Text style={styles.imageEmoji}>🖼️</Text>
          <Text style={styles.imageHint}>Cover image upload placeholder</Text>
        </Card>

        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input error={error?.message} label="Title" onChangeText={onChange} value={value} />
          )}
        />
        <Controller
          control={control}
          name="excerpt"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input error={error?.message} label="Excerpt" onChangeText={onChange} value={value} />
          )}
        />
        <Controller
          control={control}
          name="content"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input
              error={error?.message}
              label="Body"
              multiline
              numberOfLines={8}
              onChangeText={onChange}
              style={styles.textArea}
              value={value}
            />
          )}
        />

        <Button fullWidth loading={saving} onPress={onSubmit} title="Publish News" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  imagePlaceholder: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  imageEmoji: { fontSize: 48 },
  imageHint: { ...typography.caption, color: colors.textSecondary },
  textArea: { minHeight: 160, textAlignVertical: 'top' },
});

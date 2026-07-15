import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';

import { Button, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { createNewsPost, uploadImage } from '../../services/api';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'PostNews'>;

const schema = z.object({
  title: z.string().min(5, 'Title required'),
  excerpt: z.string().min(10, 'Excerpt required'),
  content: z.string().min(20, 'Body required'),
});

export function PostNewsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  const { control, handleSubmit } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', excerpt: '', content: '' },
  });

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a cover image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setLocalImageUri(uri);
    setUploading(true);
    try {
      const uploadedUrl = await uploadImage(uri, 'news');
      setImageUrl(uploadedUrl);
    } catch (err) {
      setLocalImageUri(null);
      setImageUrl(undefined);
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload image. Check Cloudinary config.',
      );
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true);
    try {
      await createNewsPost({
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        imageUrl,
      });
      Alert.alert('Published', 'News post published to all distributors.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not publish news.');
    } finally {
      setSaving(false);
    }
  });

  const previewUri = localImageUri ?? imageUrl;

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Post News" />

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={pickImage} style={styles.imageCard}>
          {previewUri ? (
            <Image contentFit="cover" source={{ uri: previewUri }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imageEmoji}>🖼️</Text>
              <Text style={styles.imageHint}>Tap to upload cover image</Text>
            </View>
          )}
          {uploading ? (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color={colors.textOnPrimary} />
              <Text style={styles.uploadText}>Uploading…</Text>
            </View>
          ) : null}
        </Pressable>
        {imageUrl ? <Text style={styles.imageOk}>Cover image ready</Text> : null}

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

        <Button
          disabled={uploading}
          fullWidth
          loading={saving}
          onPress={onSubmit}
          title="Publish News"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  imageCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  image: { height: 180, width: '100%' },
  imagePlaceholder: {
    alignItems: 'center',
    gap: spacing.sm,
    height: 180,
    justifyContent: 'center',
  },
  imageEmoji: { fontSize: 48 },
  imageHint: { ...typography.caption, color: colors.textSecondary },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  uploadText: { ...typography.label, color: colors.textOnPrimary },
  imageOk: { ...typography.caption, color: colors.success },
  textArea: { minHeight: 160, textAlignVertical: 'top' },
});

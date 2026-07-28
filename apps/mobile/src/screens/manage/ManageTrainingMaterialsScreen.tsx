import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import {
  createTrainingMaterial,
  deactivateTrainingMaterial,
  listMaterialsByCategory,
  uploadImage,
} from '../../services/api';
import type { TrainingMaterial } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageTrainingMaterials'>;
type ScreenRoute = RouteProp<ManageStackParamList, 'ManageTrainingMaterials'>;

const schema = z.object({
  title: z.string().min(2, 'Title required'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ManageTrainingMaterialsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const { categoryId, categoryName } = route.params;

  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '' },
  });

  const load = useCallback(() => {
    setLoading(true);
    listMaterialsByCategory(categoryId)
      .then(setMaterials)
      .finally(() => setLoading(false));
  }, [categoryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      // Reuses the same signed-upload flow used for images; Cloudinary
      // accepts raw file uploads through the same signature endpoint.
      const uploadedUrl = await uploadImage(result.assets[0].uri, 'training-pdf', 'raw');
      setPdfUrl(uploadedUrl);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload PDF.');
    } finally {
      setUploading(false);
    }
  };

  const openAddModal = () => {
    reset({ title: '', description: '' });
    setPdfUrl(null);
    setModalVisible(true);
  };

  const onSubmit = handleSubmit(async (data) => {
    if (!pdfUrl) {
      Alert.alert('PDF required', 'Upload a PDF before saving.');
      return;
    }
    setSaving(true);
    try {
      await createTrainingMaterial({
        category_id: categoryId,
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        pdf_url: pdfUrl,
      });
      setModalVisible(false);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save material.');
    } finally {
      setSaving(false);
    }
  });

  const handleDeactivate = async (material: TrainingMaterial) => {
    Alert.alert('Deactivate Material?', `Hide "${material.title}" from distributors?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await deactivateTrainingMaterial(material.id);
            load();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to deactivate.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ShopHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={openAddModal} style={styles.headerAction}>
            <Text style={styles.headerActionText}>+ Add</Text>
          </Pressable>
        }
        title={categoryName}
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : materials.length === 0 ? (
        <Text style={styles.empty}>No materials yet. Tap + Add to upload a PDF.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={materials}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <Text style={styles.matTitle}>{item.title}</Text>
                {item.description ? <Text style={styles.matDesc}>{item.description}</Text> : null}
              </View>
              <Pressable onPress={() => handleDeactivate(item)} style={styles.deactivateBtn}>
                <Text style={styles.deactivateText}>Deactivate</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal animationType="slide" transparent visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Material</Text>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input error={error?.message} label="Title" onChangeText={onChange} value={value} />
              )}
            />
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, value } }) => (
                <Input label="Description (optional)" onChangeText={onChange} value={value} />
              )}
            />
            <Pressable onPress={pickPdf} style={styles.pdfPickBtn}>
              <Text style={styles.pdfPickText}>
                {uploading ? 'Uploading…' : pdfUrl ? '✅ PDF uploaded' : '📄 Pick PDF'}
              </Text>
            </Pressable>
            <Button disabled={uploading} fullWidth loading={saving} onPress={onSubmit} title="Save" />
            <Button onPress={() => setModalVisible(false)} title="Cancel" variant="ghost" />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  empty: { ...typography.body, color: colors.textSecondary, padding: spacing.xxl, textAlign: 'center' },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    padding: spacing.md,
  },
  cardBody: { flex: 1, gap: spacing.xs },
  matTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  matDesc: { ...typography.caption, color: colors.textSecondary },
  deactivateBtn: { alignSelf: 'center', paddingHorizontal: spacing.sm },
  deactivateText: { ...typography.caption, color: colors.error, fontWeight: '600' },
  headerAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  headerActionText: { ...typography.label, color: colors.textOnPrimary },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: spacing.md,
    padding: spacing.xxl,
  },
  modalTitle: { ...typography.h3, color: colors.text },
  pdfPickBtn: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  pdfPickText: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
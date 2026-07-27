import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  createTrainingCategory,
  deleteTrainingCategory,
  listTrainingCategories,
  updateTrainingCategory,
} from '../../services/api';
import type { TrainingCategory } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageTraining'>;

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  description: z.string().optional(),
  sortOrder: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ManageTrainingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TrainingCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', sortOrder: '' },
  });

  const load = useCallback(() => {
    setLoading(true);
    listTrainingCategories()
      .then((data) => setCategories(data.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openAddModal = () => {
    setEditingCategory(null);
    reset({ name: '', description: '', sortOrder: '' });
    setModalVisible(true);
  };

  const openEditModal = (category: TrainingCategory) => {
    setEditingCategory(category);
    reset({
      name: category.name,
      description: category.description ?? '',
      sortOrder: category.sort_order != null ? String(category.sort_order) : '',
    });
    setModalVisible(true);
  };

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true);
    try {
      const payload = {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        sort_order: data.sortOrder ? Number(data.sortOrder) : undefined,
      };
      if (editingCategory) {
        await updateTrainingCategory(editingCategory.id, payload);
      } else {
        await createTrainingCategory(payload);
      }
      setModalVisible(false);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save category.');
    } finally {
      setSaving(false);
    }
  });

  const handleDelete = (category: TrainingCategory) => {
    Alert.alert(
      'Delete Category?',
      `Permanently delete "${category.name}"? This only works if it has no materials.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(category.id);
            try {
              await deleteTrainingCategory(category.id);
              load();
            } catch (err) {
              Alert.alert('Cannot delete', err instanceof Error ? err.message : 'Failed to delete.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
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
        title="Training Academy"
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : categories.length === 0 ? (
        <Text style={styles.empty}>No categories yet. Tap + Add to create one.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                onPress={() =>
                  navigation.navigate('ManageTrainingMaterials', {
                    categoryId: item.id,
                    categoryName: item.name,
                  })
                }
                style={styles.cardBody}
              >
                <Text style={styles.catName}>{item.name}</Text>
                {item.description ? <Text style={styles.catDesc}>{item.description}</Text> : null}
                <Text style={styles.catLink}>View / add materials →</Text>
              </Pressable>
              <View style={styles.cardActions}>
                <Pressable onPress={() => openEditModal(item)} style={styles.editBtn}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <Pressable
                  disabled={deletingId === item.id}
                  onPress={() => handleDelete(item)}
                  style={styles.editBtn}
                >
                  <Text style={styles.deleteText}>
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal animationType="slide" transparent visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value }, fieldState: { error } }) => (
                <Input error={error?.message} label="Name" onChangeText={onChange} value={value} />
              )}
            />
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, value } }) => (
                <Input label="Description (optional)" onChangeText={onChange} value={value} />
              )}
            />
            <Controller
              control={control}
              name="sortOrder"
              render={({ field: { onChange, value } }) => (
                <Input
                  keyboardType="numeric"
                  label="Sort order (optional)"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            <Button fullWidth loading={saving} onPress={onSubmit} title="Save" />
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
    padding: spacing.md,
  },
  cardBody: { gap: spacing.xs },
  catName: { ...typography.body, color: colors.text, fontWeight: '700' },
  catDesc: { ...typography.caption, color: colors.textSecondary },
  catLink: { ...typography.caption, color: colors.primary, fontWeight: '600', marginTop: spacing.xs },
  cardActions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end', marginTop: spacing.sm },
  editBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  editText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  deleteText: { ...typography.caption, color: colors.error, fontWeight: '600' },
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
});
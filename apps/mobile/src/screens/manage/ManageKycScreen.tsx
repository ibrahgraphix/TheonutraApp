import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { getPendingKyc, reviewKyc } from '../../services/api';
import type { KycSubmission } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'ManageKyc'>;

export function ManageKycScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<KycSubmission | null>(null);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getPendingKyc(1, 50)
      .then((res) => setSubmissions(res.submissions))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openDoc = (url: string) => {
    void Linking.canOpenURL(url).then((ok) => {
      if (ok) void Linking.openURL(url);
    });
  };

  const isPdf = (url: string) => url.toLowerCase().includes('.pdf') || url.includes('/raw/upload/');

  const handleDecision = async (decision: 'approve' | 'reject' | 'request_resubmission') => {
    if (!selected) return;
    setProcessing(true);
    try {
      await reviewKyc(selected.id, decision, reason.trim() || undefined);
      setSelected(null);
      setReason('');
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to review submission.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="KYC Review" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : submissions.length === 0 ? (
        <Text style={styles.empty}>No pending KYC submissions.</Text>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={submissions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelected(item)} style={styles.card}>
              <Text style={styles.name}>
                {(item as any).profiles?.full_name ?? 'Unknown'}
              </Text>
              <Text style={styles.meta}>
                {(item as any).profiles?.distributor_id ?? item.distributor_id} · {item.id_type.replace('_', ' ')}
              </Text>
              <Text style={styles.date}>
                Submitted {new Date(item.submitted_at).toLocaleDateString()}
              </Text>
            </Pressable>
          )}
        />
      )}

      <Modal animationType="slide" transparent visible={selected !== null}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalCard}>
            {selected ? (
              <>
                <Text style={styles.modalTitle}>
                  {(selected as any).profiles?.full_name ?? 'Distributor'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  ID: {selected.id_number} ({selected.id_type.replace('_', ' ')})
                </Text>

                <Text style={styles.docSectionTitle}>Document Front</Text>
                {isPdf(selected.document_front_url) ? (
                  <Pressable onPress={() => openDoc(selected.document_front_url)} style={styles.pdfLink}>
                    <Text style={styles.pdfLinkText}>📄 Open PDF</Text>
                  </Pressable>
                ) : (
                  <Image source={{ uri: selected.document_front_url }} style={styles.docImage} resizeMode="cover" />
                )}

                {selected.document_back_url ? (
                  <>
                    <Text style={styles.docSectionTitle}>Document Back</Text>
                    {isPdf(selected.document_back_url) ? (
                      <Pressable onPress={() => openDoc(selected.document_back_url!)} style={styles.pdfLink}>
                        <Text style={styles.pdfLinkText}>📄 Open PDF</Text>
                      </Pressable>
                    ) : (
                      <Image source={{ uri: selected.document_back_url }} style={styles.docImage} resizeMode="cover" />
                    )}
                  </>
                ) : null}

                {selected.selfie_url ? (
                  <>
                    <Text style={styles.docSectionTitle}>Selfie with Document</Text>
                    {isPdf(selected.selfie_url) ? (
                      <Pressable onPress={() => openDoc(selected.selfie_url!)} style={styles.pdfLink}>
                        <Text style={styles.pdfLinkText}>📄 Open PDF</Text>
                      </Pressable>
                    ) : (
                      <Image source={{ uri: selected.selfie_url }} style={styles.docImage} resizeMode="cover" />
                    )}
                  </>
                ) : null}

                <TextInput
                  onChangeText={setReason}
                  placeholder="Reason (required for reject / resubmit)"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.reasonInput}
                  value={reason}
                />

                <View style={styles.actionsRow}>
                  <Button
                    loading={processing}
                    onPress={() => handleDecision('approve')}
                    style={styles.actionBtn}
                    title="Approve"
                  />
                  <Button
                    loading={processing}
                    onPress={() => handleDecision('request_resubmission')}
                    style={styles.actionBtn}
                    title="Resubmit"
                    variant="outline"
                  />
                  <Button
                    loading={processing}
                    onPress={() => handleDecision('reject')}
                    style={styles.actionBtn}
                    title="Reject"
                    variant="outline"
                  />
                </View>
                <Button onPress={() => { setSelected(null); setReason(''); }} title="Close" variant="ghost" />
              </>
            ) : null}
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
    gap: spacing.xs,
    padding: spacing.md,
  },
  name: { ...typography.body, color: colors.text, fontWeight: '700' },
  meta: { ...typography.caption, color: colors.textSecondary },
  date: { ...typography.caption, color: colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: spacing.sm,
    maxHeight: '85%',
    padding: spacing.xxl,
  },
  modalTitle: { ...typography.h3, color: colors.text },
  modalSubtitle: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  docSectionTitle: { ...typography.label, color: colors.text, marginTop: spacing.sm },
  docImage: { borderRadius: 8, height: 160, marginTop: spacing.xs, width: '100%' },
  pdfLink: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginTop: spacing.xs,
    padding: spacing.md,
  },
  pdfLinkText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  reasonInput: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
});
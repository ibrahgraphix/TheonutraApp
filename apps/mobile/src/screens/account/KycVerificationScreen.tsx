import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { Button, Card, ShopHeader } from '../../components';
import { getMyKyc, submitKyc, uploadImage } from '../../services/api';
import type { KycSubmission, IdType } from '../../types';
import { colors, spacing, typography } from '../../theme';

type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'resubmit' | 'loading';

const STATUS_INFO: Record<string, { icon: string; label: string; desc: string; color: string }> = {
  pending: {
    icon: '⏳',
    label: 'Under Review',
    desc: 'Your documents have been submitted and are being reviewed by our team. This usually takes 1–2 business days.',
    color: '#f59e0b',
  },
  approved: {
    icon: '✅',
    label: 'Verified',
    desc: 'Your identity has been verified. You can now request withdrawals.',
    color: '#10b981',
  },
  rejected: {
    icon: '❌',
    label: 'Rejected',
    desc: 'Your submission was rejected. Please review the feedback below and resubmit.',
    color: colors.error,
  },
  resubmit_required: {
    icon: '🔄',
    label: 'Resubmission Required',
    desc: 'We need additional information. Please update your documents.',
    color: '#f59e0b',
  },
};

const DOC_TYPES: Array<[IdType, string]> = [
  ['national_id', '🪪 National ID'],
  ['passport', '📖 Passport'],
  ['voter_id', '🗳 Voter ID'],
  ['driver_license', "🚗 Driver's License"],
];

export function KycVerificationScreen() {
  const navigation = useNavigation();

  const [status, setStatus] = useState<KycStatus>('loading');
  const [submission, setSubmission] = useState<KycSubmission | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [docType, setDocType] = useState<IdType>('national_id');
  const [idNumber, setIdNumber] = useState('');
  const [frontUrl, setFrontUrl] = useState('');
  const [backUrl, setBackUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { status: s, submission: sub } = await getMyKyc();
      setSubmission(sub);
      if (!sub || s === 'not_submitted') setStatus('not_submitted');
      else if (s === 'resubmit_required') setStatus('resubmit');
      else setStatus(s as KycStatus);
    } catch {
      setStatus('not_submitted');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pickImageFor = async (setter: (url: string) => void, fieldKey: string, hint: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a document.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingField(fieldKey);
    try {
      const url = await uploadImage(result.assets[0].uri, hint, 'image');
      setter(url);
    } catch (e) {
      Alert.alert('Upload Failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setUploadingField(null);
    }
  };

  const pickPdfFor = async (setter: (url: string) => void, fieldKey: string, hint: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingField(fieldKey);
    try {
      const url = await uploadImage(result.assets[0].uri, hint, 'raw');
      setter(url);
    } catch (e) {
      Alert.alert('Upload Failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async () => {
    if (!frontUrl) {
      Alert.alert('Missing Document', 'Please upload the front of your document.');
      return;
    }
    if (!idNumber.trim()) {
      Alert.alert('Missing ID Number', 'Please enter your ID number.');
      return;
    }
    setSubmitting(true);
    try {
      await submitKyc({
        id_type: docType,
        id_number: idNumber.trim(),
        document_front_url: frontUrl,
        document_back_url: backUrl || undefined,
        selfie_url: selfieUrl || undefined,
      });
      await load();
      Alert.alert('Submitted', 'Your documents have been submitted for review.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const info = STATUS_INFO[submission?.status ?? status];

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title="Identity Verification" />

      <ScrollView contentContainerStyle={styles.content}>
        {status !== 'not_submitted' && status !== 'resubmit' && info ? (
          <Card style={[styles.statusBanner, { borderLeftColor: info.color }]}>
            <Text style={styles.statusIcon}>{info.icon}</Text>
            <Text style={[styles.statusLabel, { color: info.color }]}>{info.label}</Text>
            <Text style={styles.statusDesc}>{info.desc}</Text>
            {submission?.rejection_reason ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Reviewer notes:</Text>
                <Text style={styles.notesText}>{submission.rejection_reason}</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {(status === 'not_submitted' || status === 'resubmit') && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>Document Type</Text>
              <View style={styles.docTypeRow}>
                {DOC_TYPES.map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setDocType(val)}
                    style={[styles.docTypeBtn, docType === val && styles.docTypeBtnActive]}
                  >
                    <Text
                      style={[
                        styles.docTypeBtnText,
                        docType === val && styles.docTypeBtnTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                onChangeText={setIdNumber}
                placeholder="ID Number"
                placeholderTextColor={colors.textSecondary}
                style={styles.idNumberInput}
                value={idNumber}
              />
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Upload Documents</Text>
              <Text style={styles.hint}>Photo or PDF accepted for each document.</Text>

              <DocUploadRow
                label="Document Front *"
                url={frontUrl}
                uploading={uploadingField === 'front'}
                onPickImage={() => pickImageFor(setFrontUrl, 'front', 'kyc-front')}
                onPickPdf={() => pickPdfFor(setFrontUrl, 'front', 'kyc-front')}
                onChangeText={setFrontUrl}
              />
              <DocUploadRow
                label="Document Back (optional)"
                url={backUrl}
                uploading={uploadingField === 'back'}
                onPickImage={() => pickImageFor(setBackUrl, 'back', 'kyc-back')}
                onPickPdf={() => pickPdfFor(setBackUrl, 'back', 'kyc-back')}
                onChangeText={setBackUrl}
              />
              <DocUploadRow
                label="Selfie with document (optional)"
                url={selfieUrl}
                uploading={uploadingField === 'selfie'}
                onPickImage={() => pickImageFor(setSelfieUrl, 'selfie', 'kyc-selfie')}
                onPickPdf={() => pickPdfFor(setSelfieUrl, 'selfie', 'kyc-selfie')}
                onChangeText={setSelfieUrl}
              />
            </Card>

            <Button
              fullWidth
              loading={submitting}
              onPress={handleSubmit}
              title="Submit for Review"
            />
          </>
        )}

        {status === 'rejected' ? (
          <Button
            fullWidth
            onPress={() => setStatus('not_submitted')}
            title="Resubmit Documents"
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function DocUploadRow({
  label,
  url,
  uploading,
  onPickImage,
  onPickPdf,
  onChangeText,
}: {
  label: string;
  url: string;
  uploading: boolean;
  onPickImage: () => void;
  onPickPdf: () => void;
  onChangeText: (v: string) => void;
}) {
  const isPdf = url.toLowerCase().includes('.pdf') || url.includes('/raw/upload/');

  return (
    <View style={styles.docRow}>
      <Text style={styles.docLabel}>{label}</Text>
      <View style={styles.docInputRow}>
        <TextInput
          onChangeText={onChangeText}
          placeholder="Paste URL, or tap 📷/📄 to upload"
          placeholderTextColor={colors.textSecondary}
          style={styles.docInput}
          value={url}
        />
        <TouchableOpacity onPress={onPickImage} style={styles.uploadBtn}>
          <Text style={styles.uploadBtnText}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onPickPdf} style={styles.uploadBtn}>
          <Text style={styles.uploadBtnText}>📄</Text>
        </TouchableOpacity>
      </View>
      {uploading ? (
        <ActivityIndicator color={colors.primary} style={styles.uploadingIndicator} />
      ) : url && !isPdf ? (
        <Image source={{ uri: url }} style={styles.docPreview} resizeMode="cover" />
      ) : url && isPdf ? (
        <Text style={styles.pdfBadge}>📄 PDF uploaded</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  statusBanner: { borderLeftWidth: 4, gap: spacing.sm },
  statusIcon: { fontSize: 32, textAlign: 'center' },
  statusLabel: { ...typography.h3, fontWeight: '700', textAlign: 'center' },
  statusDesc: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  notesBox: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.sm,
  },
  notesLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  notesText: { ...typography.bodySmall, color: colors.text },
  docTypeRow: { gap: spacing.sm },
  docTypeBtn: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: spacing.sm,
    alignItems: 'center',
  },
  docTypeBtnActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  docTypeBtnText: { ...typography.bodySmall, color: colors.textSecondary },
  docTypeBtnTextActive: { color: colors.primary, fontWeight: '700' },
  idNumberInput: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  docRow: { gap: spacing.xs, marginBottom: spacing.md },
  docLabel: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  docInputRow: { flexDirection: 'row', gap: spacing.sm },
  docInput: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    padding: spacing.md,
  },
  uploadBtn: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: spacing.md,
  },
  uploadBtnText: { fontSize: 20 },
  docPreview: { borderRadius: 8, height: 100, marginTop: spacing.xs, width: '100%' },
  uploadingIndicator: { marginTop: spacing.xs },
  pdfBadge: { ...typography.bodySmall, color: colors.success, marginTop: spacing.xs },
});
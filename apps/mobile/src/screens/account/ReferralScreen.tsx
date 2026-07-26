import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { Card, ShopHeader } from '../../components';
import { getMyReferralInfo } from '../../services/api';
import type { ReferralInfo } from '../../types';
import { colors, spacing, typography } from '../../theme';

export function ReferralScreen() {
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReferral(await getMyReferralInfo());
    } catch {
      // keep null
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleShare = async () => {
    if (!referral) return;
    try {
      await Share.share({
        message: `Join me! Use my referral code: ${referral.referral_code}\n${referral.referral_link}`,
        title: 'Join',
      });
    } catch { /* ignore */ }
  };

  const handleCopyCode = async () => {
    if (!referral) return;
    try {
      const Clipboard = await import('@react-native-clipboard/clipboard').catch(() => null);
      if (Clipboard) {
        Clipboard.default.setString(referral.referral_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        void handleShare();
      }
    } catch {
      void handleShare();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ShopHeader title="Referral" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.qrCard}>
          <Text style={styles.qrTitle}>Your Referral QR Code</Text>
          {referral?.referral_code ? (
            <View style={styles.qrWrap}>
              <QRCode size={180} value={referral.referral_link} color={colors.text} backgroundColor="transparent" />
            </View>
          ) : (
            <Text style={styles.noCode}>No referral code yet.</Text>
          )}
          {referral?.referral_code ? (
            <TouchableOpacity onPress={handleCopyCode} style={styles.codeBox}>
              <Text style={styles.code}>{referral.referral_code}</Text>
              <Text style={styles.copyHint}>{copied ? '✅ Copied!' : 'Tap to copy'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>🔗 Share My Referral Link</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  qrCard: { alignItems: 'center', gap: spacing.md },
  qrTitle: { ...typography.h3, color: colors.text },
  qrWrap: { backgroundColor: '#fff', borderRadius: 16, padding: spacing.lg },
  noCode: { ...typography.bodySmall, color: colors.textSecondary },
  codeBox: { alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: 12, padding: spacing.md, width: '100%' },
  code: { ...typography.h2, color: colors.primary, fontWeight: '800', letterSpacing: 4 },
  copyHint: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  shareBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, width: '100%', alignItems: 'center' },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
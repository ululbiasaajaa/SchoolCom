import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildReportUrl } from '../../constants/report';
import {
    getActiveReportLink,
    getOrCreateReportLink,
    revokeReportLink,
} from '../../service/reportLinkService';

interface ReportLinkModalProps {
  visible: boolean;
  studentId: string;
  studentName: string;
  academicYear: string;
  term: string;
  teacherName: string;
  onClose: () => void;
}

type LinkState = 'loading' | 'none' | 'active';

/**
 * REV-03: Modal kelola link rapor read-only per siswa+periode.
 * - "none": belum ada link aktif -> tombol "Buat Link Rapor"
 * - "active": ada link aktif -> tampilkan URL + Salin + Kirim WA + Cabut
 * Revoke bersifat permanen (lihat komentar di reportLinkService.ts) — abis
 * revoke, state balik ke "none" dan guru bisa bikin link baru kalau perlu.
 */
export default function ReportLinkModal({
  visible,
  studentId,
  studentName,
  academicYear,
  term,
  teacherName,
  onClose,
}: ReportLinkModalProps) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LinkState>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setState('loading');
    getActiveReportLink(studentId, academicYear, term)
      .then((link) => {
        if (link) {
          setToken(link.token);
          setState('active');
        } else {
          setToken(null);
          setState('none');
        }
      })
      .catch(() => {
        Alert.alert('Gagal', 'Tidak bisa memuat status link rapor.');
        setState('none');
      });
  }, [visible, studentId, academicYear, term]);

  const handleGenerate = async () => {
    setIsBusy(true);
    try {
      const link = await getOrCreateReportLink(
        studentId,
        studentName,
        academicYear,
        term,
        teacherName
      );
      setToken(link.token);
      setState('active');
    } catch {
      Alert.alert('Gagal', 'Terjadi kesalahan saat membuat link rapor.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!token) return;
    await Clipboard.setStringAsync(buildReportUrl(token));
    Alert.alert('Tersalin', 'Link rapor sudah disalin ke clipboard.');
  };

  const handleShareWA = () => {
    if (!token) return;
    const message = `Rapor ${studentName} (${academicYear} - ${term}) sudah bisa dilihat di link berikut:\n${buildReportUrl(token)}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Gagal', 'Tidak bisa membuka WhatsApp.');
    });
  };

  const handleRevoke = () => {
    if (!token) return;
    Alert.alert(
      'Cabut Link Rapor',
      'Link ini akan langsung mati dan tidak bisa dibuka lagi oleh siapapun yang sudah menerimanya. Yakin?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Cabut',
          style: 'destructive',
          onPress: async () => {
            setIsBusy(true);
            try {
              await revokeReportLink(token);
              setToken(null);
              setState('none');
            } catch {
              Alert.alert('Gagal', 'Terjadi kesalahan saat mencabut link.');
            } finally {
              setIsBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>🔗 Link Rapor</Text>
              <Text style={styles.subtitle}>
                {studentName} • {academicYear} ({term})
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {state === 'loading' && (
            <View style={styles.centerBox}>
              <ActivityIndicator color="#2563EB" />
            </View>
          )}

          {state === 'none' && (
            <View style={styles.centerBox}>
              <Text style={styles.infoText}>
                Belum ada link rapor untuk siswa & periode ini. Orang tua yang tidak
                install aplikasi bisa lihat rapor lewat link ini tanpa install apapun.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
                onPress={handleGenerate}
                disabled={isBusy}
              >
                {isBusy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>🔗 Buat Link Rapor</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {state === 'active' && token && (
            <View>
              <View style={styles.linkBox}>
                <Text style={styles.linkText} numberOfLines={2}>
                  {buildReportUrl(token)}
                </Text>
              </View>
              <Text style={styles.activeHint}>
                Link ini aktif dan tidak akan kadaluarsa sendiri. Kalau perlu, cabut
                manual lewat tombol di bawah.
              </Text>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopy}>
                <Text style={styles.secondaryBtnText}>📋 Salin Link</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleShareWA}>
                <Text style={styles.secondaryBtnText}>📱 Kirim via WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.revokeBtn, isBusy && styles.btnDisabled]}
                onPress={handleRevoke}
                disabled={isBusy}
              >
                {isBusy ? (
                  <ActivityIndicator color="#DC2626" size="small" />
                ) : (
                  <Text style={styles.revokeBtnText}>🚫 Cabut Link</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  linkBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  linkText: {
    fontSize: 12,
    color: '#1E3A8A',
  },
  activeHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  secondaryBtn: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  revokeBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  revokeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
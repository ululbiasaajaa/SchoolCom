import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { FollowUpLog, Incident, StatusType } from '../../types/schoolcom';
import { getStatusBadgeStyle } from '../../utils/badges';

interface FollowUpModalProps {
  visible: boolean;
  incident: Incident | null;
  onClose: () => void;
  onSave: (incidentId: string, status: StatusType, logText: string) => Promise<void> | void;
}

const STATUS_OPTIONS: StatusType[] = ['Pending', 'Follow-up', 'Resolved'];

export default function FollowUpModal({
  visible,
  incident,
  onClose,
  onSave,
}: FollowUpModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<StatusType>('Pending');
  const [logText, setLogText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Helper Sanitasi Status
  const getSafeStatus = (raw: string | undefined): StatusType => {
    const s = (raw || '').toString();
    return ['Pending', 'Follow-up', 'Resolved'].includes(s) ? (s as StatusType) : 'Pending';
  };

  useEffect(() => {
    if (visible && incident) {
      // Inisialisasi state dengan status yang sudah disanitasi
      setSelectedStatus(getSafeStatus(incident.status));
      setLogText('');
      setIsSubmitting(false);
    }
  }, [visible, incident]);

  if (!incident) return null;

  const safeStatus = getSafeStatus(incident.status);
  const badge = getStatusBadgeStyle(safeStatus);

  // Filter hanya log yang mempunyai isi catatan (note tidak kosong) dengan tipe data eksplisit FollowUpLog
  const validLogs = (incident.followUpLogs || []).filter(
    (log: FollowUpLog) => log.note && log.note.trim().length > 0
  );

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(incident.id, selectedStatus, logText.trim());
      // Jika berhasil, parent akan menutup modal
    } catch (error) {
      console.error('Error saving follow-up:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Update Status & Tindak Lanjut</Text>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Detail Incident Ringkas */}
            <View style={styles.detailBox}>
              <View style={styles.rowBetween}>
                <Text style={styles.categoryText}>{incident.category || 'Incident'}</Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {badge.symbol} {safeStatus}
                  </Text>
                </View>
              </View>
              <Text style={styles.descText}>{incident.description}</Text>
              <Text style={styles.metaText}>
                Oleh: {incident.teacherName || 'Guru'} • {incident.createdAt}
              </Text>
            </View>

            {/* Riwayat Log Sebelumnya (Hanya yang valid/berisi) */}
            {validLogs.length > 0 && (
              <View style={styles.logsSection}>
                <Text style={styles.label}>Riwayat Catatan Tindak Lanjut ({validLogs.length}):</Text>
                {validLogs.map((log: FollowUpLog & { author?: string; date?: string }, index: number) => (
                  <View key={index} style={styles.logCard}>
                    <Text style={styles.logNote}>{log.note}</Text>
                    <Text style={styles.logMeta}>
                      {log.author || 'Guru'} • {log.updatedAt || log.date || 'Baru saja'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Ubah Status */}
            <Text style={styles.label}>Ubah Status *</Text>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map((st) => {
                const isSelected = st === selectedStatus;
                return (
                  <TouchableOpacity
                    key={st}
                    disabled={isSubmitting}
                    style={[
                      styles.statusChip,
                      isSelected && styles.statusChipActive,
                      isSubmitting && styles.disabledOpacity,
                    ]}
                    onPress={() => setSelectedStatus(st)}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        isSelected && styles.statusChipTextActive,
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tambahkan Catatan Log Baru (Hardened dengan maxLength 1000) */}
            <Text style={styles.label}>Tambah Catatan Perkembangan (Opsional - Maks. 1000 Karakter)</Text>
            <TextInput
              style={[styles.textArea, isSubmitting && styles.disabledOpacity]}
              placeholder="Contoh: Sudah diajak bicara dengan orang tua, anak berjanji tidak mengulangi..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              maxLength={1000}
              value={logText}
              onChangeText={setLogText}
              editable={!isSubmitting}
            />
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, isSubmitting && styles.disabledOpacity]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && styles.disabledBtn]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Simpan Tindak Lanjut</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  scrollContent: {
    marginBottom: 12,
  },
  detailBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  descText: {
    fontSize: 13,
    color: '#1F2937',
    marginTop: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  logsSection: {
    marginBottom: 12,
  },
  logCard: {
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  logNote: {
    fontSize: 12,
    color: '#1F2937',
  },
  logMeta: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 6,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#111827',
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 13,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  disabledBtn: {
    backgroundColor: '#93C5FD',
  },
  disabledOpacity: {
    opacity: 0.6,
  },
});
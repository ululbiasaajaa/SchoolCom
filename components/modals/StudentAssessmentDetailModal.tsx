import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface AssessmentDraftValue {
  score: string; // '' = kosong
  predicate: string | null;
  narrative: string;
}

// Bentuk minimal yang dibutuhkan modal ini — sengaja didefinisikan lokal
// (bukan import dari types/schoolcom.ts) supaya modal ini gak gantung ke nama
// tipe persis yang belum pernah kita lihat langsung. Cukup match struktur
// `activeSubject.fields` dan `config.predicates` yang sudah dipakai di
// TeacherAssessmentView.tsx.
interface SubjectFieldFlags {
  enableNumeric: boolean;
  enablePredicate: boolean;
  enableNarrative: boolean;
}

interface PredicateOption {
  id: string;
  label: string;
}

interface StudentAssessmentDetailModalProps {
  visible: boolean;
  studentName: string;
  subjectName: string;
  fields: SubjectFieldFlags;
  predicateOptions: PredicateOption[];
  value: AssessmentDraftValue;
  onChange: (next: AssessmentDraftValue) => void;
  onClose: () => void;
}

/**
 * REV-02: Modal detail per-siswa buat isi Predikat & Narasi (dan Nilai Angka
 * kalau mau diedit dari sini juga). SENGAJA TIDAK menulis ke Firestore
 * langsung — modal ini cuma mengedit `draftValues` yang di-share sama grid
 * induk (TeacherAssessmentView). Penyimpanan sungguhan cuma terjadi 1x lewat
 * tombol "Simpan Semua" di halaman grid, biar guru tetap punya 1 titik
 * commit yang jelas, bukan nyebar di banyak tempat.
 */
export default function StudentAssessmentDetailModal({
  visible,
  studentName,
  subjectName,
  fields,
  predicateOptions,
  value,
  onChange,
  onClose,
}: StudentAssessmentDetailModalProps) {
  const insets = useSafeAreaInsets();

  const handleScoreChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      onChange({ ...value, score: '' });
      return;
    }
    const num = parseInt(cleaned, 10);
    if (num <= 100) {
      onChange({ ...value, score: String(num) });
    } else {
      onChange({ ...value, score: '100' });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{studentName}</Text>
              <Text style={styles.subtitle}>{subjectName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {fields.enableNumeric && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nilai Angka (0 - 100):</Text>
                <TextInput
                  style={styles.numericInput}
                  keyboardType="numeric"
                  maxLength={3}
                  placeholder="Contoh: 85"
                  value={value.score}
                  onChangeText={handleScoreChange}
                />
              </View>
            )}

            {fields.enablePredicate && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Predikat / Capaian *:</Text>
                {predicateOptions.length === 0 ? (
                  <Text style={styles.infoText}>Belum ada daftar predikat dari Admin.</Text>
                ) : (
                  <View style={styles.predicateGrid}>
                    {predicateOptions.map((p) => {
                      const isSelected = value.predicate === p.label;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.predicateChip, isSelected && styles.predicateChipActive]}
                          onPress={() =>
                            onChange({ ...value, predicate: isSelected ? null : p.label })
                          }
                        >
                          <Text
                            style={[
                              styles.predicateChipText,
                              isSelected && styles.predicateChipTextActive,
                            ]}
                          >
                            {p.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {fields.enableNarrative && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Catatan Narasi Perkembangan *:</Text>
                <TextInput
                  style={styles.textArea}
                  multiline
                  numberOfLines={4}
                  placeholder="Tuliskan deskripsi/catatan perkembangan siswa..."
                  value={value.narrative}
                  onChangeText={(text) => onChange({ ...value, narrative: text })}
                  textAlignVertical="top"
                />
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>✓ Selesai</Text>
          </TouchableOpacity>
          <Text style={styles.doneHint}>
            Perubahan disimpan ke server saat kamu menekan "Simpan Semua" di halaman grid.
          </Text>
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  body: {
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
  },
  numericInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    width: 120,
  },
  predicateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  predicateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  predicateChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  predicateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  predicateChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#111827',
    minHeight: 90,
  },
  doneBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  doneHint: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});
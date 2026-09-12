import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addDailyGrade,
  calculateSuggestedScore,
  deleteDailyGrade,
  markDailyGradesAsNotified,
  subscribeToDailyGradesByStudentDomain,
} from '../../service/dailyGradeService';
import { notifyParentOnDailyGrades } from '../../service/pushNotificationService';
import { DailyGrade, DailyGradeType } from '../../types/schoolcom';

interface DailyGradeModalProps {
  visible: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  classId: string;
  domainId: string; // Lihat catatan di dailyGradeService.ts soal ID ini
  domainName: string; // Nama mapel/aspek buat ditampilkan
  academicYear: string;
  term: string;
  teacherName: string;
}

const GRADE_TYPES: DailyGradeType[] = ['Kuis', 'Tugas', 'Ulangan', 'Praktik', 'Observasi'];

const todayDateString = (): string => new Date().toISOString().split('T')[0];

export default function DailyGradeModal({
  visible,
  onClose,
  studentId,
  studentName,
  classId,
  domainId,
  domainName,
  academicYear,
  term,
  teacherName,
}: DailyGradeModalProps) {
  // FIX UI/UX: modal ini bergaya "bottom sheet" (nempel di dasar layar) —
  // tombol paling bawah bisa ketiban gesture/navigation bar Android kalau gak
  // dikasih padding tambahan sesuai tinggi nav bar device masing-masing.
  const insets = useSafeAreaInsets();

  const [grades, setGrades] = useState<DailyGrade[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSendingNotification, setIsSendingNotification] = useState<boolean>(false);

  // Form Tambah Entri
  const [formDate, setFormDate] = useState(todayDateString());
  const [formType, setFormType] = useState<DailyGradeType>('Tugas');
  const [formScore, setFormScore] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !studentId || !domainId) {
      setGrades([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToDailyGradesByStudentDomain(
      studentId,
      domainId,
      academicYear,
      term,
      (fetchedGrades) => {
        setGrades(fetchedGrades);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [visible, studentId, domainId, academicYear, term]);

  // Reset form tiap modal ditutup, biar gak kebawa data lama pas dibuka lagi buat siswa/mapel lain
  useEffect(() => {
    if (!visible) {
      setFormDate(todayDateString());
      setFormType('Tugas');
      setFormScore('');
      setFormNotes('');
    }
  }, [visible]);

  const suggestedAverage = useMemo(() => calculateSuggestedScore(grades), [grades]);

  // EVT-06: entri yang belum pernah diikutkan dalam notifikasi ke ortu
  const unnotifiedGrades = useMemo(() => grades.filter((g) => !g.notifiedAt), [grades]);

  const handleSendNotification = async () => {
    if (unnotifiedGrades.length === 0) {
      Alert.alert('Tidak Ada yang Perlu Dikirim', 'Semua nilai harian di mapel ini sudah dinotifikasikan ke ortu.');
      return;
    }

    setIsSendingNotification(true);
    try {
      await notifyParentOnDailyGrades(studentId, studentName, domainName, unnotifiedGrades.length);
      await markDailyGradesAsNotified(unnotifiedGrades.map((g) => g.id));
      Alert.alert('Terkirim', `Notifikasi ${unnotifiedGrades.length} nilai harian berhasil dikirim ke ortu.`);
    } catch (error) {
      console.error('Error sending daily grade notification:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat mengirim notifikasi.');
    } finally {
      setIsSendingNotification(false);
    }
  };

  // Pola clamp angka sama seperti di TeacherAssessmentView — cegah nilai di luar 0-100
  const handleScoreChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      setFormScore('');
      return;
    }
    const num = parseInt(cleaned, 10);
    if (num >= 0 && num <= 100) {
      setFormScore(String(num));
    } else if (num > 100) {
      setFormScore('100');
    }
  };

  const handleAddGrade = async () => {
    if (formScore.trim() === '') {
      Alert.alert('Form Belum Lengkap', 'Nilai wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDailyGrade({
        studentId,
        classId,
        domainId,
        academicYear,
        term,
        date: formDate,
        score: parseInt(formScore, 10),
        type: formType,
        notes: formNotes.trim() || undefined,
        teacherName,
      });

      // Reset cuma field skor & catatan, tanggal & tipe dibiarkan (biasanya guru
      // input beberapa siswa sekaligus untuk aktivitas yang sama di tanggal yang sama)
      setFormScore('');
      setFormNotes('');
    } catch (error) {
      console.error('Error adding daily grade:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan nilai harian.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGrade = (grade: DailyGrade) => {
    Alert.alert(
      'Hapus Nilai Harian',
      `Hapus entri "${grade.type}" tanggal ${grade.date} (nilai ${grade.score})?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDailyGrade(grade.id);
            } catch (error) {
              console.error('Error deleting daily grade:', error);
              Alert.alert('Gagal', 'Terjadi kesalahan saat menghapus entri.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.modalHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Nilai Harian</Text>
              <Text style={styles.modalSubtitle}>
                {studentName} • {domainName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Ringkasan Rata-rata Sementara */}
          <View style={styles.averageBox}>
            <Text style={styles.averageLabel}>Rata-rata Sementara (dari {grades.length} entri)</Text>
            <Text style={styles.averageValue}>
              {suggestedAverage !== null ? suggestedAverage.toFixed(1) : '-'}
            </Text>
            <Text style={styles.averageHint}>
              Bisa dipakai sebagai referensi saat mengisi nilai rapor akhir semester.
            </Text>
          </View>

          {/* EVT-06: Kirim Notifikasi Manual — guru review dulu, baru kirim sekali klik */}
          <TouchableOpacity
            style={[
              styles.notifyBtn,
              (isSendingNotification || unnotifiedGrades.length === 0) && styles.notifyBtnDisabled,
            ]}
            onPress={handleSendNotification}
            disabled={isSendingNotification || unnotifiedGrades.length === 0}
          >
            {isSendingNotification ? (
              <ActivityIndicator color="#7C3AED" size="small" />
            ) : (
              <Text style={styles.notifyBtnText}>
                {unnotifiedGrades.length > 0
                  ? `📨 Kirim Notifikasi ke Ortu (${unnotifiedGrades.length} belum dikirim)`
                  : '✓ Semua Sudah Dinotifikasi'}
              </Text>
            )}
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 12 }} />
            ) : grades.length === 0 ? (
              <Text style={styles.emptyText}>Belum ada nilai harian tercatat untuk periode ini.</Text>
            ) : (
              grades.map((g) => (
                <View key={g.id} style={styles.gradeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gradeRowTitle}>
                      {g.type} • {g.date} {g.notifiedAt ? '✓' : ''}
                    </Text>
                    {g.notes ? <Text style={styles.gradeRowNotes}>{g.notes}</Text> : null}
                  </View>
                  <Text style={styles.gradeRowScore}>{g.score}</Text>
                  <TouchableOpacity onPress={() => handleDeleteGrade(g)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          {/* Form Tambah Entri Baru */}
          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>Jenis Penilaian:</Text>
            <View style={styles.typeSelectorRow}>
              {GRADE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, formType === type && styles.typeChipActive]}
                  onPress={() => setFormType(type)}
                >
                  <Text style={[styles.typeChipText, formType === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Tanggal:</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="YYYY-MM-DD"
                  value={formDate}
                  onChangeText={setFormDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Nilai (0-100):</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="0-100"
                  keyboardType="number-pad"
                  value={formScore}
                  onChangeText={handleScoreChange}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Catatan (Opsional):</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Misal: kesulitan di soal cerita"
              value={formNotes}
              onChangeText={setFormNotes}
            />

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleAddGrade}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>+ Tambah Nilai Harian</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  notifyBtn: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  notifyBtnDisabled: {
    opacity: 0.6,
  },
  notifyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  averageBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  averageLabel: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '600',
  },
  averageValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
    marginTop: 2,
  },
  averageHint: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  gradeRowTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  gradeRowNotes: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  gradeRowScore: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563EB',
    marginHorizontal: 10,
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    fontSize: 14,
  },
  formSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 6,
    marginBottom: 4,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typeChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  formRow: {
    flexDirection: 'row',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
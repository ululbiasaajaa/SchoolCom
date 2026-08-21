import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  saveAssessmentBatch,
  subscribeToAssessmentConfig,
  subscribeToAssessments,
} from '../../service/assessmentService';
import { notifyParentOnAssessment } from '../../service/pushNotificationService';
import {
  AssessmentConfig,
  Student,
  StudentAssessment,
} from '../../types/schoolcom';
import { exportAssessmentsToCSV } from '../../utils/csvExporter';
import { exportStudentReportPDF } from '../../utils/pdfGenerator';

interface TeacherAssessmentViewProps {
  students: Student[];
  teacherName?: string;
}

// Opsi Periode
const ACADEMIC_YEARS = ['2025/2026', '2026/2027'];
const TERMS = ['Semester 1', 'Semester 2'];

export default function TeacherAssessmentView({
  students,
  teacherName = 'Guru',
}: TeacherAssessmentViewProps) {
  // State Periode Aktif
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('2026/2027');
  const [selectedTerm, setSelectedTerm] = useState<string>('Semester 1');

  // State Config & Data Assessments dari Firestore
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const [existingAssessments, setExistingAssessments] = useState<StudentAssessment[]>([]);

  // State Matpel & Siswa Aktif yang dipilih Guru
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // State Draft Form Input Penilaian
  const [formScore, setFormScore] = useState<string>('');
  const [formPredicate, setFormPredicate] = useState<string | null>(null);
  const [formNarrative, setFormNarrative] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savingMode, setSavingMode] = useState<'single' | 'continue' | null>(null);

  // 1. Subscribe Realtime Config berdasarkan Periode Aktif
  useEffect(() => {
    setIsLoadingConfig(true);
    const unsubConfig = subscribeToAssessmentConfig(
      selectedAcademicYear,
      selectedTerm,
      (fetchedConfig) => {
        setConfig(fetchedConfig);
        setIsLoadingConfig(false);

        // Auto select matpel pertama jika matpel aktif belum dipilih/tidak valid
        if (fetchedConfig && fetchedConfig.subjects.length > 0) {
          setSelectedSubjectId((prev) => {
            const exists = fetchedConfig.subjects.some((s) => s.id === prev);
            return exists ? prev : fetchedConfig.subjects[0].id;
          });
        } else {
          setSelectedSubjectId(null);
        }
      }
    );

    return () => unsubConfig();
  }, [selectedAcademicYear, selectedTerm]);

  // 2. Subscribe Realtime Assessments berdasarkan Periode Aktif
  useEffect(() => {
    const unsubAssessments = subscribeToAssessments(
      selectedAcademicYear,
      selectedTerm,
      (fetchedRecords) => {
        setExistingAssessments(fetchedRecords);
      }
    );

    return () => unsubAssessments();
  }, [selectedAcademicYear, selectedTerm]);

  // Auto select siswa pertama jika list siswa ada dan belum ada yang dipilih
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  // Subjek yang sedang dipilih
  const activeSubject = config?.subjects.find((s) => s.id === selectedSubjectId);
  // Siswa yang sedang dipilih
  const activeStudent = students.find((s) => s.id === selectedStudentId);

  // Assessment yang tersimpan untuk Siswa + Subjek + Periode aktif
  const currentSavedAssessment = existingAssessments.find(
    (a) =>
      a.studentId === selectedStudentId &&
      a.subjectId === selectedSubjectId &&
      a.academicYear === selectedAcademicYear &&
      a.term === selectedTerm
  );

  // Synchronize Form State saat siswa, matpel, atau data tersimpan berubah
  useEffect(() => {
    if (currentSavedAssessment) {
      setFormScore(
        currentSavedAssessment.score !== null && currentSavedAssessment.score !== undefined
          ? String(currentSavedAssessment.score)
          : ''
      );
      setFormPredicate(currentSavedAssessment.predicate || null);
      setFormNarrative(currentSavedAssessment.narrative || '');
    } else {
      // Belum ada data tersimpan: reset form ke kosong
      setFormScore('');
      setFormPredicate(null);
      setFormNarrative('');
    }
  }, [selectedStudentId, selectedSubjectId, currentSavedAssessment]);

  // Handle Perubahan Input Nilai Numeric (Validasi 0-100)
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

  // Handle Simpan Penilaian (Single & Continue Mode)
  const handleSaveAssessment = async (shouldContinue: boolean = false) => {
    if (!activeStudent || !activeSubject) {
      Alert.alert('Peringatan', 'Silakan pilih siswa dan mata pelajaran terlebih dahulu.');
      return;
    }

    const fields = activeSubject.fields;
    let numericValue: number | null | undefined = undefined;

    // A. Validasi Field Numeric
    if (fields.enableNumeric) {
      if (formScore.trim() !== '') {
        const parsed = parseInt(formScore, 10);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
          Alert.alert('Validasi Gagal', 'Nilai angka harus berada di antara 0 - 100.');
          return;
        }
        numericValue = parsed;
      } else {
        numericValue = null;
      }
    }

    // B. Validasi Field Predicate (Jika Diaktifkan)
    if (fields.enablePredicate && config && config.predicates.length > 0) {
      if (!formPredicate) {
        Alert.alert('Validasi Gagal', 'Silakan pilih salah satu predikat/capaian.');
        return;
      }
    }

    // C. Validasi Field Narrative (Jika Diaktifkan)
    const trimmedNarrative = formNarrative.trim();
    if (fields.enableNarrative) {
      if (!trimmedNarrative) {
        Alert.alert(
          'Validasi Gagal',
          'Catatan perkembangan belum diisi. Silakan lengkapi narasi sebelum menyimpan.'
        );
        return;
      }
    }

    setIsSaving(true);
    setSavingMode(shouldContinue ? 'continue' : 'single');

    try {
      const now = new Date();
      const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const recordPayload: Omit<StudentAssessment, 'id'> = {
        studentId: activeStudent.id,
        studentName: activeStudent.name,
        className: activeStudent.className || 'Kelas',
        academicYear: selectedAcademicYear,
        term: selectedTerm,
        subjectId: activeSubject.id,
        subjectName: activeSubject.name,
        teacherName,
        createdAt: currentSavedAssessment?.createdAt || timestampStr,
        updatedAt: timestampStr,
      };

      if (fields.enableNumeric) {
        recordPayload.score = numericValue;
      }
      if (fields.enablePredicate) {
        recordPayload.predicate = formPredicate || null;
      }
      if (fields.enableNarrative) {
        recordPayload.narrative = trimmedNarrative || null;
      }

      await saveAssessmentBatch([recordPayload]);

      // TRIGGER PUSH NOTIFICATION EVT-04 (INFORMASI RAPOR / PENILAIAN BARU KE PARENT)
      notifyParentOnAssessment(
        activeStudent.id,
        activeStudent.name,
        activeSubject.name
      ).catch((err) => console.warn('Gagal memicu push notifikasi penilaian:', err));

      if (shouldContinue) {
        // Cari posisi index siswa aktif saat ini
        const currentIndex = students.findIndex((s) => s.id === activeStudent.id);
        const hasNextStudent = currentIndex !== -1 && currentIndex < students.length - 1;

        if (hasNextStudent) {
          const nextStudent = students[currentIndex + 1];
          setSelectedStudentId(nextStudent.id);
        } else {
          Alert.alert(
            'Selesai',
            `Penilaian untuk ${activeStudent.name} berhasil disimpan. Seluruh siswa pada daftar sudah selesai diproses.`
          );
        }
      } else {
        Alert.alert('Sukses', `Penilaian ${activeSubject.name} untuk ${activeStudent.name} berhasil disimpan!`);
      }
    } catch (error: unknown) {
      console.error('Error saving assessment:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan penilaian.');
    } finally {
      setIsSaving(false);
      setSavingMode(null);
    }
  };

  // Handle Export PDF Rapor Siswa Active
  const handleExportPDF = () => {
    if (!activeStudent) {
      Alert.alert('Peringatan', 'Pilih siswa terlebih dahulu.');
      return;
    }
    if (!config) {
      Alert.alert('Peringatan', 'Konfigurasi penilaian belum dimuat.');
      return;
    }

    exportStudentReportPDF(activeStudent, config, existingAssessments, teacherName);
  };

  // Handle Export CSV Rekap Penilaian
  const handleExportCSV = () => {
    if (!config) {
      Alert.alert('Peringatan', 'Konfigurasi penilaian belum dimuat.');
      return;
    }
    if (students.length === 0) {
      Alert.alert('Peringatan', 'Tidak ada data siswa untuk diekspor.');
      return;
    }

    exportAssessmentsToCSV(students, config, existingAssessments, teacherName);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Banner */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>📝 Penilaian Siswa (Rapor)</Text>
        <Text style={styles.headerSub}>Penginput: {teacherName}</Text>
      </View>

      {/* Filter Periode (Tahun Ajaran & Semester) */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionLabel}>Tahun Ajaran & Semester:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {ACADEMIC_YEARS.map((year) => (
            <TouchableOpacity
              key={year}
              style={[styles.chip, selectedAcademicYear === year && styles.chipActive]}
              onPress={() => setSelectedAcademicYear(year)}
            >
              <Text style={[styles.chipText, selectedAcademicYear === year && styles.chipTextActive]}>
                📅 {year}
              </Text>
            </TouchableOpacity>
          ))}
          {TERMS.map((term) => (
            <TouchableOpacity
              key={term}
              style={[styles.chip, selectedTerm === term && styles.chipActiveTerm]}
              onPress={() => setSelectedTerm(term)}
            >
              <Text style={[styles.chipText, selectedTerm === term && styles.chipTextActive]}>
                📌 {term}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* State Loading / Error Config */}
      {isLoadingConfig ? (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.infoText}>Memuat konfigurasi penilaian...</Text>
        </View>
      ) : !config || config.subjects.length === 0 ? (
        <View style={styles.centerCard}>
          <Text style={styles.emptyTitle}>⚠️ Belum Ada Konfigurasi Penilaian</Text>
          <Text style={styles.infoText}>
            Admin belum mengatur mata pelajaran atau aspek perkembangan untuk periode {selectedAcademicYear} - {selectedTerm}.
          </Text>
        </View>
      ) : (
        <>
          {/* Selector Mata Pelajaran / Aspek */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Mata Pelajaran / Aspek Perkembangan:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {config.subjects.map((sub) => {
                const isActive = selectedSubjectId === sub.id;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={[styles.chip, isActive && styles.chipActiveSubject]}
                    onPress={() => setSelectedSubjectId(sub.id)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      📚 {sub.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Selector Siswa dengan Highlight Indicator Clear */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Pilih Siswa:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {students.map((std) => {
                const isActive = selectedStudentId === std.id;
                const hasAssessed = existingAssessments.some(
                  (a) =>
                    a.studentId === std.id &&
                    a.subjectId === selectedSubjectId &&
                    a.academicYear === selectedAcademicYear &&
                    a.term === selectedTerm
                );

                return (
                  <TouchableOpacity
                    key={std.id}
                    style={[
                      styles.studentChip,
                      hasAssessed && styles.studentChipFilled,
                      isActive && styles.studentChipActive,
                    ]}
                    onPress={() => setSelectedStudentId(std.id)}
                  >
                    <Text style={[
                      styles.studentChipText,
                      hasAssessed && styles.studentChipTextFilled,
                      isActive && styles.studentChipTextActive
                    ]}>
                      {std.avatar || '👦'} {std.name} {hasAssessed ? '✓ Terisi' : '⚪ Belum'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Form Penilaian Dinamis */}
          {activeSubject && activeStudent && (
            <View style={styles.formCard}>
              <View style={styles.formHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>{activeStudent.name}</Text>
                  <Text style={styles.formSubTitle}>
                    {activeSubject.name} • {selectedAcademicYear} ({selectedTerm})
                  </Text>
                </View>

                {/* Badge Status Dinamis & Trigger Buttons */}
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[styles.statusBadge, currentSavedAssessment ? styles.badgeSuccess : styles.badgePending]}>
                    <Text style={styles.statusBadgeText}>
                      {currentSavedAssessment ? 'Tersimpan' : 'Belum Diisi'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={styles.pdfExportBtn} onPress={handleExportPDF}>
                      <Text style={styles.pdfExportBtnText}>📄 PDF Rapor</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.csvExportBtn} onPress={handleExportCSV}>
                      <Text style={styles.csvExportBtnText}>📊 Export CSV</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* 1. Field Numeric (Jika Active) */}
              {activeSubject.fields.enableNumeric && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nilai Angka (0 - 100):</Text>
                  <TextInput
                    style={styles.numericInput}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholder="Contoh: 85"
                    value={formScore}
                    onChangeText={handleScoreChange}
                  />
                </View>
              )}

              {/* 2. Field Predicate (Jika Active) */}
              {activeSubject.fields.enablePredicate && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Predikat / Capaian *:</Text>
                  {config.predicates.length === 0 ? (
                    <Text style={styles.infoText}>Belum ada daftar predikat dari Admin.</Text>
                  ) : (
                    <View style={styles.predicateGrid}>
                      {config.predicates.map((p) => {
                        const isSelected = formPredicate === p.label;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[
                              styles.predicateChip,
                              isSelected && styles.predicateChipActive,
                            ]}
                            onPress={() => setFormPredicate(isSelected ? null : p.label)}
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

              {/* 3. Field Narrative (Jika Active) */}
              {activeSubject.fields.enableNarrative && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Catatan Narasi Perkembangan *:</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={4}
                    placeholder="Tuliskan deskripsi/catatan perkembangan siswa..."
                    value={formNarrative}
                    onChangeText={setFormNarrative}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Action Buttons Area */}
              <View style={styles.buttonActionRow}>
                {/* Tombol Simpan & Lanjut */}
                <TouchableOpacity
                  style={[styles.saveContinueBtn, isSaving && styles.saveBtnDisabled]}
                  onPress={() => handleSaveAssessment(true)}
                  disabled={isSaving}
                >
                  {isSaving && savingMode === 'continue' ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveContinueBtnText}>
                      ⏩ Simpan & Lanjut
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Tombol Simpan / Perbarui Utama */}
                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                  onPress={() => handleSaveAssessment(false)}
                  disabled={isSaving}
                >
                  {isSaving && savingMode === 'single' ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {currentSavedAssessment ? '✏️ Perbarui Penilaian' : '💾 Simpan Penilaian'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSub: {
    color: '#BFDBFE',
    fontSize: 12,
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#2563EB',
  },
  chipActiveTerm: {
    backgroundColor: '#059669',
  },
  chipActiveSubject: {
    backgroundColor: '#7C3AED',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  studentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  studentChipFilled: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  studentChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  studentChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  studentChipTextFilled: {
    color: '#166534',
  },
  studentChipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  centerCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D97706',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
    marginBottom: 24,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  formSubTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  pdfExportBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  pdfExportBtnText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '600',
  },
  csvExportBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  csvExportBtnText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
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
  buttonActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  saveContinueBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveContinueBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
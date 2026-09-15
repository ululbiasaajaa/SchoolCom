import React, { useEffect, useRef, useState } from 'react';
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
  markAssessmentsAsNotified,
  saveAssessmentBatch,
  subscribeToAssessmentConfig,
  subscribeToAssessments,
} from '../../service/assessmentService';
import { subscribeToClasses } from '../../service/classService';
import { notifyParentOnAssessment } from '../../service/pushNotificationService';
import {
  AssessmentConfig,
  SchoolClass,
  Student,
  StudentAssessment,
} from '../../types/schoolcom';
import { exportAssessmentsToCSV } from '../../utils/csvExporter';
import {
  getComingSoonMessage,
  isAssessmentModeReady,
  resolveEducationLevel,
} from '../../utils/educationLevelHelper';
import { exportStudentReportPDF } from '../../utils/pdfGenerator';
import DailyGradeModal from '../modals/DailyGradeModal';
import ReportLinkModal from '../modals/ReportLinkModal';
import StudentAssessmentDetailModal, {
  AssessmentDraftValue,
} from '../modals/StudentAssessmentDetailModal';

interface TeacherAssessmentViewProps {
  students: Student[];
  teacherName?: string;
}

const ACADEMIC_YEARS = ['2025/2026', '2026/2027'];
const TERMS = ['Semester 1', 'Semester 2'];

const EMPTY_DRAFT: AssessmentDraftValue = { score: '', predicate: null, narrative: '' };

const hasAssessmentContent = (a: StudentAssessment): boolean => {
  return (
    (a.score !== null && a.score !== undefined) ||
    !!a.predicate ||
    !!a.narrative
  );
};

export default function TeacherAssessmentView({
  students,
  teacherName = 'Guru',
}: TeacherAssessmentViewProps) {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('2026/2027');
  const [selectedTerm, setSelectedTerm] = useState<string>('Semester 1');

  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const [existingAssessments, setExistingAssessments] = useState<StudentAssessment[]>([]);

  const existingAssessmentsRef = useRef<StudentAssessment[]>([]);
  useEffect(() => {
    existingAssessmentsRef.current = existingAssessments;
  }, [existingAssessments]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const [draftValues, setDraftValues] = useState<Record<string, AssessmentDraftValue>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);

  const [isSendingNotif, setIsSendingNotif] = useState<boolean>(false);

  const [dailyGradeStudentId, setDailyGradeStudentId] = useState<string | null>(null);

  // REV-03: studentId yang lagi dibuka modal Link Rapor-nya. Ini level
  // PERIODE (academicYear+term), bukan per-mapel — jadi gak butuh
  // activeSubject terpilih buat dipakai.
  const [reportLinkStudentId, setReportLinkStudentId] = useState<string | null>(null);

  const [classes, setClasses] = useState<SchoolClass[]>([]);

  useEffect(() => {
    const unsub = subscribeToClasses((fetchedClasses) => setClasses(fetchedClasses));
    return () => unsub();
  }, []);

  useEffect(() => {
    setIsLoadingConfig(true);
    const unsubConfig = subscribeToAssessmentConfig(
      selectedAcademicYear,
      selectedTerm,
      (fetchedConfig) => {
        setConfig(fetchedConfig);
        setIsLoadingConfig(false);

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

  const activeSubject = config?.subjects.find((s) => s.id === selectedSubjectId);

  useEffect(() => {
    const next: Record<string, AssessmentDraftValue> = {};
    students.forEach((std) => {
      const saved = existingAssessmentsRef.current.find(
        (a) =>
          a.studentId === std.id &&
          a.subjectId === selectedSubjectId &&
          a.academicYear === selectedAcademicYear &&
          a.term === selectedTerm
      );
      next[std.id] = {
        score:
          saved?.score !== null && saved?.score !== undefined ? String(saved.score) : '',
        predicate: saved?.predicate || null,
        narrative: saved?.narrative || '',
      };
    });
    setDraftValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId, selectedAcademicYear, selectedTerm, students]);

  const isStudentDirty = (studentId: string): boolean => {
    const draft = draftValues[studentId];
    if (!draft) return false;
    const saved = existingAssessments.find(
      (a) =>
        a.studentId === studentId &&
        a.subjectId === selectedSubjectId &&
        a.academicYear === selectedAcademicYear &&
        a.term === selectedTerm
    );
    const savedScoreStr =
      saved?.score !== null && saved?.score !== undefined ? String(saved.score) : '';
    const savedPredicate = saved?.predicate || null;
    const savedNarrative = saved?.narrative || '';
    return (
      draft.score !== savedScoreStr ||
      draft.predicate !== savedPredicate ||
      draft.narrative !== savedNarrative
    );
  };

  const hasUnsavedChanges = students.some((s) => isStudentDirty(s.id));

  const unnotifiedAssessments = existingAssessments.filter(
    (a) =>
      a.subjectId === selectedSubjectId &&
      a.academicYear === selectedAcademicYear &&
      a.term === selectedTerm &&
      !a.notifiedAt &&
      hasAssessmentContent(a)
  );

  const guardedChange = (action: () => void) => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Perubahan Belum Disimpan',
        'Ada nilai yang belum di-"Simpan Semua". Kalau lanjut, perubahan ini akan hilang. Tetap lanjut?',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Lanjut, Buang Perubahan', style: 'destructive', onPress: action },
        ]
      );
    } else {
      action();
    }
  };

  const handleGridScoreChange = (studentId: string, text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setDraftValues((prev) => {
      const current = prev[studentId] || EMPTY_DRAFT;
      if (cleaned === '') {
        return { ...prev, [studentId]: { ...current, score: '' } };
      }
      const num = parseInt(cleaned, 10);
      const clamped = num > 100 ? 100 : num;
      return { ...prev, [studentId]: { ...current, score: String(clamped) } };
    });
  };

  const handleSaveAll = async () => {
    if (!activeSubject || !config) return;

    const fields = activeSubject.fields;
    const timestampNow = new Date();
    const timestampStr = `${timestampNow.getFullYear()}-${String(timestampNow.getMonth() + 1).padStart(2, '0')}-${String(timestampNow.getDate()).padStart(2, '0')} ${String(timestampNow.getHours()).padStart(2, '0')}:${String(timestampNow.getMinutes()).padStart(2, '0')}`;

    const touchedStudents = students.filter((std) => {
      const d = draftValues[std.id];
      if (!d) return false;
      const hasAny = d.score.trim() !== '' || !!d.predicate || d.narrative.trim() !== '';
      const wasSaved = existingAssessments.some(
        (a) =>
          a.studentId === std.id &&
          a.subjectId === selectedSubjectId &&
          a.academicYear === selectedAcademicYear &&
          a.term === selectedTerm
      );
      return hasAny || wasSaved;
    });

    if (touchedStudents.length === 0) {
      Alert.alert('Peringatan', 'Belum ada nilai yang diisi untuk disimpan.');
      return;
    }

    const invalidNames: string[] = [];
    touchedStudents.forEach((std) => {
      const d = draftValues[std.id];
      if (fields.enableNumeric && d.score.trim() !== '') {
        const parsed = parseInt(d.score, 10);
        if (isNaN(parsed) || parsed < 0 || parsed > 100) {
          invalidNames.push(`${std.name} (nilai angka tidak valid)`);
          return;
        }
      }
      if (fields.enablePredicate && config.predicates.length > 0 && !d.predicate) {
        invalidNames.push(`${std.name} (predikat belum dipilih)`);
        return;
      }
      if (fields.enableNarrative && d.narrative.trim() === '') {
        invalidNames.push(`${std.name} (narasi belum diisi)`);
      }
    });

    if (invalidNames.length > 0) {
      Alert.alert(
        'Belum Lengkap',
        `Siswa berikut belum lengkap:\n\n${invalidNames.join('\n')}\n\nLengkapi dulu lewat tombol "›" sebelum menyimpan.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload: Omit<StudentAssessment, 'id'>[] = touchedStudents.map((std) => {
        const d = draftValues[std.id];
        const existing = existingAssessments.find(
          (a) =>
            a.studentId === std.id &&
            a.subjectId === selectedSubjectId &&
            a.academicYear === selectedAcademicYear &&
            a.term === selectedTerm
        );

        const record: Omit<StudentAssessment, 'id'> = {
          studentId: std.id,
          studentName: std.name,
          className: std.className || 'Kelas',
          academicYear: selectedAcademicYear,
          term: selectedTerm,
          subjectId: activeSubject.id,
          subjectName: activeSubject.name,
          teacherName,
          createdAt: existing?.createdAt || timestampStr,
          updatedAt: timestampStr,
        };

        if (fields.enableNumeric) {
          record.score = d.score.trim() !== '' ? parseInt(d.score, 10) : null;
        }
        if (fields.enablePredicate) {
          record.predicate = d.predicate || null;
        }
        if (fields.enableNarrative) {
          record.narrative = d.narrative.trim() || null;
        }

        return record;
      });

      await saveAssessmentBatch(payload);

      Alert.alert(
        'Sukses',
        `${touchedStudents.length} nilai ${activeSubject.name} berhasil disimpan.\n\nJangan lupa pencet "Kirim Notifikasi ke Ortu" kalau sudah yakin semua nilai benar.`
      );
    } catch (error: unknown) {
      console.error('Error saving assessment grid batch:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan nilai.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendNotifications = async () => {
    if (unnotifiedAssessments.length === 0) return;
    if (!activeSubject) return;

    Alert.alert(
      'Kirim Notifikasi ke Ortu',
      `Kirim notifikasi ke ${unnotifiedAssessments.length} orang tua siswa untuk nilai ${activeSubject.name}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Kirim',
          onPress: async () => {
            setIsSendingNotif(true);
            try {
              const results = await Promise.allSettled(
                unnotifiedAssessments.map((a) =>
                  notifyParentOnAssessment(a.studentId, a.studentName, a.subjectName)
                )
              );

              const failedCount = results.filter((r) => r.status === 'rejected').length;
              await markAssessmentsAsNotified(unnotifiedAssessments.map((a) => a.id));

              if (failedCount > 0) {
                Alert.alert(
                  'Selesai (Sebagian)',
                  `Notifikasi terkirim, tapi ${failedCount} dari ${unnotifiedAssessments.length} gagal (kemungkinan ortu belum install app / token tidak valid).`
                );
              } else {
                Alert.alert(
                  'Sukses',
                  `Notifikasi ${activeSubject.name} berhasil dikirim ke ${unnotifiedAssessments.length} orang tua.`
                );
              }
            } catch (error: unknown) {
              console.error('Error sending batch assessment notifications:', error);
              Alert.alert('Gagal', 'Terjadi kesalahan saat mengirim notifikasi.');
            } finally {
              setIsSendingNotif(false);
            }
          },
        },
      ]
    );
  };

  const handleExportPDF = (student: Student) => {
    if (!config) {
      Alert.alert('Peringatan', 'Konfigurasi penilaian belum dimuat.');
      return;
    }
    exportStudentReportPDF(student, config, existingAssessments, teacherName);
  };

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

  const handleOpenDailyGrade = (student: Student) => {
    if (!student.classId) {
      Alert.alert(
        'Kelas Belum Termigrasi',
        'Siswa ini belum punya data kelas hasil migrasi (classId). Jalankan "Migrasi Data Kelas Lama" dulu di tab Kelas (Admin) sebelum mengisi nilai harian.'
      );
      return;
    }
    setDailyGradeStudentId(student.id);
  };

  const dailyGradeStudent = students.find((s) => s.id === dailyGradeStudentId);
  const detailStudent = students.find((s) => s.id === detailStudentId);
  const reportLinkStudent = students.find((s) => s.id === reportLinkStudentId);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>📝 Penilaian Siswa (Rapor)</Text>
        <Text style={styles.headerSub}>Penginput: {teacherName}</Text>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionLabel}>Tahun Ajaran & Semester:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {ACADEMIC_YEARS.map((year) => (
            <TouchableOpacity
              key={year}
              style={[styles.chip, selectedAcademicYear === year && styles.chipActive]}
              onPress={() => guardedChange(() => setSelectedAcademicYear(year))}
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
              onPress={() => guardedChange(() => setSelectedTerm(term))}
            >
              <Text style={[styles.chipText, selectedTerm === term && styles.chipTextActive]}>
                📌 {term}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Mata Pelajaran / Aspek Perkembangan:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {config.subjects.map((sub) => {
                const isActive = selectedSubjectId === sub.id;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={[styles.chip, isActive && styles.chipActiveSubject]}
                    onPress={() => guardedChange(() => setSelectedSubjectId(sub.id))}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      📚 {sub.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {unnotifiedAssessments.length > 0 && (
            <View style={styles.notifyBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifyBannerTitle}>
                  📨 {unnotifiedAssessments.length} nilai belum dikirim ke ortu
                </Text>
                <Text style={styles.notifyBannerSub}>
                  Untuk mata pelajaran {activeSubject?.name}.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.notifyBtn, isSendingNotif && styles.btnDisabled]}
                onPress={handleSendNotifications}
                disabled={isSendingNotif}
              >
                {isSendingNotif ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.notifyBtnText}>Kirim</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.toolbarRow}>
            <TouchableOpacity style={styles.csvExportBtn} onPress={handleExportCSV}>
              <Text style={styles.csvExportBtnText}>📊 Export CSV Sekelas</Text>
            </TouchableOpacity>
          </View>

          {activeSubject && (
            <View style={styles.gridCard}>
              <View style={styles.gridHeaderRow}>
                <Text style={[styles.gridHeaderText, styles.gridNameCol]}>Nama Siswa</Text>
                {activeSubject.fields.enableNumeric && (
                  <Text style={[styles.gridHeaderText, styles.gridScoreCol]}>Nilai</Text>
                )}
                <Text style={[styles.gridHeaderText, styles.gridActionCol]}> </Text>
              </View>

              {students.map((std) => {
                const draft = draftValues[std.id] || EMPTY_DRAFT;
                const dirty = isStudentDirty(std.id);
                const eduLevel = resolveEducationLevel(std.classId, classes);
                const ready = isAssessmentModeReady(eduLevel);
                const needsDetail =
                  activeSubject.fields.enablePredicate || activeSubject.fields.enableNarrative;

                if (!ready) {
                  return (
                    <View key={std.id} style={styles.gridRowComingSoon}>
                      <Text style={styles.gridRowComingSoonText}>
                        {std.avatar || '👦'} {std.name} — 🚧 {getComingSoonMessage(eduLevel)}
                      </Text>
                    </View>
                  );
                }

                return (
                  <View key={std.id} style={[styles.gridRow, dirty && styles.gridRowDirty]}>
                    <View style={styles.gridNameCol}>
                      <Text style={styles.gridNameText} numberOfLines={1}>
                        {std.avatar || '👦'} {std.name}
                      </Text>
                      {(draft.predicate || draft.narrative) && (
                        <Text style={styles.gridSubText} numberOfLines={1}>
                          {draft.predicate ? `${draft.predicate}` : ''}
                          {draft.predicate && draft.narrative ? ' • ' : ''}
                          {draft.narrative ? 'ada narasi' : ''}
                        </Text>
                      )}
                    </View>

                    {activeSubject.fields.enableNumeric && (
                      <View style={styles.gridScoreCol}>
                        <TextInput
                          style={styles.gridScoreInput}
                          keyboardType="numeric"
                          maxLength={3}
                          placeholder="-"
                          value={draft.score}
                          onChangeText={(text) => handleGridScoreChange(std.id, text)}
                        />
                      </View>
                    )}

                    <View style={styles.gridActionCol}>
                      <TouchableOpacity
                        style={styles.rowIconBtn}
                        onPress={() => handleOpenDailyGrade(std)}
                      >
                        <Text style={styles.rowIconText}>📝</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rowIconBtn}
                        onPress={() => handleExportPDF(std)}
                      >
                        <Text style={styles.rowIconText}>📄</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rowIconBtn}
                        onPress={() => setReportLinkStudentId(std.id)}
                      >
                        <Text style={styles.rowIconText}>🔗</Text>
                      </TouchableOpacity>
                      {needsDetail && (
                        <TouchableOpacity
                          style={styles.rowChevronBtn}
                          onPress={() => setDetailStudentId(std.id)}
                        >
                          <Text style={styles.rowChevronText}>›</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                style={[styles.saveAllBtn, isSaving && styles.btnDisabled]}
                onPress={handleSaveAll}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveAllBtnText}>💾 Simpan Semua</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {detailStudent && activeSubject && (
        <StudentAssessmentDetailModal
          visible={!!detailStudentId}
          studentName={detailStudent.name}
          subjectName={activeSubject.name}
          fields={activeSubject.fields}
          predicateOptions={config?.predicates || []}
          value={draftValues[detailStudent.id] || EMPTY_DRAFT}
          onChange={(next) =>
            setDraftValues((prev) => ({ ...prev, [detailStudent.id]: next }))
          }
          onClose={() => setDetailStudentId(null)}
        />
      )}

      {reportLinkStudent && (
        <ReportLinkModal
          visible={!!reportLinkStudentId}
          studentId={reportLinkStudent.id}
          studentName={reportLinkStudent.name}
          academicYear={selectedAcademicYear}
          term={selectedTerm}
          teacherName={teacherName}
          onClose={() => setReportLinkStudentId(null)}
        />
      )}

      {dailyGradeStudent && activeSubject && dailyGradeStudent.classId && (
        <DailyGradeModal
          visible={!!dailyGradeStudentId}
          onClose={() => setDailyGradeStudentId(null)}
          studentId={dailyGradeStudent.id}
          studentName={dailyGradeStudent.name}
          classId={dailyGradeStudent.classId}
          domainId={activeSubject.id}
          domainName={activeSubject.name}
          academicYear={selectedAcademicYear}
          term={selectedTerm}
          teacherName={teacherName}
        />
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
  notifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  notifyBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  notifyBannerSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
  },
  notifyBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  notifyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  csvExportBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  csvExportBtnText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
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
  gridCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    marginBottom: 24,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  gridHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  gridRowDirty: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  gridRowComingSoon: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  gridRowComingSoonText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  gridNameCol: {
    flex: 1,
    paddingRight: 8,
  },
  gridNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  gridSubText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  gridScoreCol: {
    width: 64,
    alignItems: 'center',
  },
  gridScoreInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    width: 56,
    textAlign: 'center',
  },
  gridActionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 116,
    justifyContent: 'flex-end',
  },
  rowIconBtn: {
    padding: 4,
  },
  rowIconText: {
    fontSize: 14,
  },
  rowChevronBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rowChevronText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  saveAllBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveAllBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
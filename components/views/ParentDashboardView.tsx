import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Import Firestore Helpers
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

import {
  subscribeToAllStudentAssessments,
  subscribeToAssessmentConfig,
  subscribeToStudentAssessments,
} from '../../service/assessmentService';
import {
  AttendanceRecord,
  subscribeToStudentAttendance,
} from '../../service/attendanceService';
import {
  subscribeToIncidentsByStudentIds,
} from '../../service/incidentService';
import {
  AssessmentConfig,
  Incident,
  Student,
  StudentAssessment,
  User,
} from '../../types/schoolcom';
import { AssessmentPeriodSummary, groupAssessmentsByPeriod } from '../../utils/historyHelper';
import {
  DEFAULT_SCHOOL_NAME,
  exportStudentAttendanceReportPDF,
  exportStudentIncidentReportPDF,
  exportStudentReportPDF,
} from '../../utils/pdfGenerator';

// Import Analytics Helpers (Tahap 12.1)
import {
  getStudentProgressMetrics,
  groupAssessmentsBySubject,
  TrendDirection,
} from '../../utils/analyticsHelper';

// Import Attendance Helpers (Tahap 14.4)
import {
  calculateAttendanceSummary,
  groupAttendanceByMonth,
} from '../../utils/attendanceHelper';

interface ParentDashboardViewProps {
  currentUser: User;
  students?: Student[]; // Dibuat opsional karena Parent mengambil data spesifiknya sendiri
}

export default function ParentDashboardView({
  currentUser,
}: ParentDashboardViewProps) {
  // 1. Periode Akademik Aktif (Default)
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('2026/2027');
  const [selectedTerm, setSelectedTerm] = useState<string>('Semester 1');

  // 2. State Profil Siswa Milik Parent (Targeted Fetch)
  const [parentStudents, setParentStudents] = useState<Student[]>([]);
  const [isStudentsLoading, setIsStudentsLoading] = useState<boolean>(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // 3. State Data Read-Only (Assessments & Attendance)
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // State terpisah khusus Attendance (Mencegah Attribution Lag & Re-Fetch Tidak Perlu)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState<boolean>(true);

  // State khusus Incident / Catatan Perilaku (Sub-Phase 15.2)
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isIncidentsLoading, setIsIncidentsLoading] = useState<boolean>(true);

  // 4. State History Rapor & Penilaian (Tahap 11.2)
  const [allHistoryAssessments, setAllHistoryAssessments] = useState<StudentAssessment[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [selectedHistoryPeriod, setSelectedHistoryPeriod] = useState<AssessmentPeriodSummary | null>(null);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState<boolean>(false);

  // 5. State Analytics & Progress (Tahap 12.2 - Terisolasi)
  const [isAnalyticsModalVisible, setIsAnalyticsModalVisible] = useState<boolean>(false);

  // 6. State Loading Ekspor PDF (Sub-Phase 16.4)
  const [isExportingAcademic, setIsExportingAcademic] = useState<boolean>(false);
  const [isExportingAttendance, setIsExportingAttendance] = useState<boolean>(false);
  const [isExportingIncident, setIsExportingIncident] = useState<boolean>(false);

  // AUTO-RESET STATE SAAT SWITCHING ANAK (Mencegah Stale State)
  const handleSelectStudent = (studentId: string) => {
    if (studentId !== selectedStudentId) {
      setIsHistoryModalVisible(false);
      setIsAnalyticsModalVisible(false);
      setSelectedHistoryPeriod(null);
      setSelectedStudentId(studentId);
    }
  };

  // 7. Targeted Fetch Profil Siswa Spesifik Milik Parent
  useEffect(() => {
    const fetchParentStudents = async () => {
      if (!currentUser.studentIds || currentUser.studentIds.length === 0) {
        setParentStudents([]);
        setIsStudentsLoading(false);
        return;
      }

      try {
        const studentPromises = currentUser.studentIds.map(async (sId) => {
          const sRef = doc(db, 'students', sId);
          const sSnap = await getDoc(sRef);
          if (sSnap.exists()) {
            return { id: sSnap.id, ...sSnap.data() } as Student;
          }
          return null;
        });

        const results = await Promise.all(studentPromises);
        const validStudents = results.filter((s): s is Student => s !== null);

        setParentStudents(validStudents);
        if (validStudents.length > 0) {
          setSelectedStudentId((prev) => prev || validStudents[0].id);
        }
      } catch (error: unknown) {
        console.error('Error fetching parent student profiles:', error);
      } finally {
        setIsStudentsLoading(false);
      }
    };

    fetchParentStudents();
  }, [currentUser.studentIds]);

  // 8A. Realtime Subscription Manager untuk Assessment & Config (Terikat Periode Aktif)
  useEffect(() => {
    if (!selectedStudentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Subscribe Config Periode
    const unsubConfig = subscribeToAssessmentConfig(
      selectedAcademicYear,
      selectedTerm,
      (fetchedConfig) => {
        setConfig(fetchedConfig);
      }
    );

    // Subscribe Assessment Spesifik 1 Anak (Periode Aktif)
    const unsubAssessments = subscribeToStudentAssessments(
      selectedStudentId,
      selectedAcademicYear,
      selectedTerm,
      (fetchedAssessments) => {
        setAssessments(fetchedAssessments);
        setIsLoading(false);
      }
    );

    return () => {
      unsubConfig();
      unsubAssessments();
    };
  }, [selectedStudentId, selectedAcademicYear, selectedTerm]);

  // 8B. Realtime Subscription Manager khusus Attendance (Hanya Terikat ID Anak)
  useEffect(() => {
    if (!selectedStudentId) {
      setAttendanceRecords([]);
      setIsAttendanceLoading(false);
      return;
    }

    setAttendanceRecords([]);
    setIsAttendanceLoading(true);

    const unsubAttendance = subscribeToStudentAttendance(
      selectedStudentId,
      (fetchedAttendance) => {
        setAttendanceRecords(fetchedAttendance);
        setIsAttendanceLoading(false);
      }
    );

    return () => {
      unsubAttendance();
    };
  }, [selectedStudentId]);

  // 8C. Realtime Subscription Manager khusus Incident (Sub-Phase 15.2 - Scoped per studentIds Parent)
  useEffect(() => {
    const studentIds = currentUser.studentIds || [];
    if (studentIds.length === 0) {
      setIncidents([]);
      setIsIncidentsLoading(false);
      return;
    }

    setIsIncidentsLoading(true);
    const unsubIncidents = subscribeToIncidentsByStudentIds(
      studentIds,
      (fetchedIncidents) => {
        setIncidents(fetchedIncidents);
        setIsIncidentsLoading(false);
      }
    );

    return () => {
      unsubIncidents();
    };
  }, [currentUser.studentIds]);

  // 9. Realtime Subscription Manager khusus untuk History & Analytics (Lintas Periode)
  useEffect(() => {
    if (!selectedStudentId) {
      setAllHistoryAssessments([]);
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);

    const unsubHistory = subscribeToAllStudentAssessments(
      selectedStudentId,
      (fetchedHistory) => {
        setAllHistoryAssessments(fetchedHistory);
        setIsHistoryLoading(false);
      }
    );

    return () => {
      unsubHistory();
    };
  }, [selectedStudentId]);

  // 10. Filter Insiden berdasarkan Anak Aktif yang Dipilih
  const currentStudentIncidents = useMemo(() => {
    if (!selectedStudentId) return [];
    return incidents.filter((inc) => inc.studentId === selectedStudentId);
  }, [incidents, selectedStudentId]);

  // 11. Pengelompokan History Menggunakan Helper 11.1
  const historyPeriods = useMemo(() => {
    return groupAssessmentsByPeriod(allHistoryAssessments);
  }, [allHistoryAssessments]);

  // 12. Agregasi Metrics & Progression Analytics Menggunakan Helper 12.1
  const progressMetrics = useMemo(() => {
    return getStudentProgressMetrics(historyPeriods);
  }, [historyPeriods]);

  const subjectProgressions = useMemo(() => {
    return groupAssessmentsBySubject(allHistoryAssessments);
  }, [allHistoryAssessments]);

  // 13. Agregasi & Grouping Presensi Menggunakan Helper 14.4
  const overallAttendanceSummary = useMemo(() => {
    return calculateAttendanceSummary(attendanceRecords);
  }, [attendanceRecords]);

  const monthlyAttendanceGroups = useMemo(() => {
    return groupAttendanceByMonth(attendanceRecords);
  }, [attendanceRecords]);

  // Data Siswa Aktif yang Dipilih
  const activeStudent = parentStudents.find((s) => s.id === selectedStudentId);

  // Helper Renderer Badge Trend Delta (Tahap 12.2)
  const renderTrendBadge = (direction: TrendDirection, delta: number | null) => {
    switch (direction) {
      case 'up':
        return (
          <View style={[styles.trendBadge, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.trendBadgeText, { color: '#2E7D32' }]}>
              ▲ +{delta !== null ? delta.toFixed(1) : ''}
            </Text>
          </View>
        );
      case 'down':
        return (
          <View style={[styles.trendBadge, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.trendBadgeText, { color: '#C62828' }]}>
              ▼ {delta !== null ? delta.toFixed(1) : ''}
            </Text>
          </View>
        );
      case 'stable':
        return (
          <View style={[styles.trendBadge, { backgroundColor: '#E3F2FD' }]}>
            <Text style={[styles.trendBadgeText, { color: '#1565C0' }]}>
              ▶ 0.0 (Konstan)
            </Text>
          </View>
        );
      case 'initial':
      default:
        return (
          <View style={[styles.trendBadge, { backgroundColor: '#F5F5F5' }]}>
            <Text style={[styles.trendBadgeText, { color: '#616161' }]}>
              ⚪ Periode Perdana
            </Text>
          </View>
        );
    }
  };

  // Helper Renderer Badge Status Presensi Harian
  const renderAttendanceStatusBadge = (status: string) => {
    switch (status) {
      case 'Present':
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.statusBadgeText, { color: '#2E7D32' }]}>✓ Hadir</Text>
          </View>
        );
      case 'Sick':
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#FFF3E0' }]}>
            <Text style={[styles.statusBadgeText, { color: '#E65100' }]}>🤒 Sakit</Text>
          </View>
        );
      case 'Permission':
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#E3F2FD' }]}>
            <Text style={[styles.statusBadgeText, { color: '#1565C0' }]}>✉️ Izin</Text>
          </View>
        );
      case 'Absent':
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.statusBadgeText, { color: '#C62828' }]}>❌ Alpha</Text>
          </View>
        );
      case 'Late':
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#F3E5F5' }]}>
            <Text style={[styles.statusBadgeText, { color: '#7B1FA2' }]}>⏰ Terlambat</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.statusBadge, { backgroundColor: '#ECEFF1' }]}>
            <Text style={[styles.statusBadgeText, { color: '#455A64' }]}>{status}</Text>
          </View>
        );
    }
  };

  // Helper Renderer Badge Status Incident
  const renderIncidentStatusBadge = (status: string) => {
    switch (status) {
      case 'Resolved':
        return (
          <View style={[styles.incidentBadge, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}>
            <Text style={[styles.incidentBadgeText, { color: '#2E7D32' }]}>✓ Selesai</Text>
          </View>
        );
      case 'Follow-up':
        return (
          <View style={[styles.incidentBadge, { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }]}>
            <Text style={[styles.incidentBadgeText, { color: '#1565C0' }]}>🔄 Tindak Lanjut</Text>
          </View>
        );
      case 'Pending':
      default:
        return (
          <View style={[styles.incidentBadge, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]}>
            <Text style={[styles.incidentBadgeText, { color: '#E65100' }]}>⏳ Membutuhkan Perhatian</Text>
          </View>
        );
    }
  };

  // Helper Renderer Badge Priority Incident
  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return (
          <View style={[styles.priorityBadge, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.priorityBadgeText, { color: '#C62828' }]}>🔥 Darurat</Text>
          </View>
        );
      case 'High':
        return (
          <View style={[styles.priorityBadge, { backgroundColor: '#FFF3E0' }]}>
            <Text style={[styles.priorityBadgeText, { color: '#E65100' }]}>⚠️ Tinggi</Text>
          </View>
        );
      case 'Medium':
        return (
          <View style={[styles.priorityBadge, { backgroundColor: '#E3F2FD' }]}>
            <Text style={[styles.priorityBadgeText, { color: '#1565C0' }]}>🔵 Sedang</Text>
          </View>
        );
      case 'Low':
      default:
        return (
          <View style={[styles.priorityBadge, { backgroundColor: '#F5F5F5' }]}>
            <Text style={[styles.priorityBadgeText, { color: '#616161' }]}>🟢 Rendah</Text>
          </View>
        );
    }
  };

  // Handler Download PDF Rapor (Periode Aktif)
  const handleDownloadPDF = async () => {
    if (!activeStudent) {
      Alert.alert('Peringatan', 'Data siswa tidak ditemukan.');
      return;
    }

    if (!config) {
      Alert.alert('Peringatan', 'Konfigurasi penilaian periode ini belum tersedia.');
      return;
    }

    setIsExportingAcademic(true);
    try {
      const resolvedTeacherName =
        assessments.find((a) => a.teacherName)?.teacherName ||
        activeStudent.className ||
        'Wali Kelas';

      await exportStudentReportPDF(activeStudent, config, assessments, resolvedTeacherName, DEFAULT_SCHOOL_NAME);
    } finally {
      setIsExportingAcademic(false);
    }
  };

  // Handler Download PDF Rekap Presensi (Sub-Phase 16.4 - Fixed Teacher Resolution)
  const handleDownloadAttendancePDF = async () => {
    if (!activeStudent) {
      Alert.alert('Peringatan', 'Data siswa tidak ditemukan.');
      return;
    }

    setIsExportingAttendance(true);
    try {
      const resolvedTeacherName =
        attendanceRecords.find((r) => r.teacherName)?.teacherName ||
        activeStudent.className ||
        'Wali Kelas';

      await exportStudentAttendanceReportPDF(
        activeStudent,
        attendanceRecords,
        resolvedTeacherName,
        DEFAULT_SCHOOL_NAME
      );
    } finally {
      setIsExportingAttendance(false);
    }
  };

  // Handler Download PDF Rekap Perilaku/Insiden (Sub-Phase 16.4 - Fixed Teacher Resolution)
  const handleDownloadIncidentPDF = async () => {
    if (!activeStudent) {
      Alert.alert('Peringatan', 'Data siswa tidak ditemukan.');
      return;
    }

    setIsExportingIncident(true);
    try {
      const resolvedTeacherName =
        currentStudentIncidents.find((i) => i.teacherName)?.teacherName ||
        activeStudent.className ||
        'Wali Kelas';

      await exportStudentIncidentReportPDF(
        activeStudent,
        currentStudentIncidents,
        resolvedTeacherName,
        DEFAULT_SCHOOL_NAME
      );
    } finally {
      setIsExportingIncident(false);
    }
  };

  // Handler Download PDF Rapor dari Riwayat (History Period)
  const handleDownloadHistoryPDF = async (periodSummary: AssessmentPeriodSummary) => {
    if (!activeStudent) {
      Alert.alert('Peringatan', 'Data siswa tidak ditemukan.');
      return;
    }

    const resolvedTeacherName =
      periodSummary.assessments.find((a) => a.teacherName)?.teacherName ||
      activeStudent.className ||
      'Wali Kelas';

    const dummyConfig: AssessmentConfig = {
      id: `${periodSummary.academicYear.replace(/\//g, '-')}_${periodSummary.term.replace(/\s+/g, '_')}`,
      academicYear: periodSummary.academicYear,
      term: periodSummary.term,
      predicates: [],
      subjects: periodSummary.assessments.map((a) => ({
        id: a.subjectId,
        name: a.subjectName,
        category: 'Academic',
        fields: { enableNumeric: true, enablePredicate: true, enableNarrative: true },
      })),
      updatedAt: new Date().toISOString(),
    };

    await exportStudentReportPDF(
      activeStudent,
      dummyConfig,
      periodSummary.assessments,
      resolvedTeacherName,
      DEFAULT_SCHOOL_NAME
    );
  };

  // Loading Screen Saat Mengambil Profil Siswa
  if (isStudentsLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  // Guard: Akun Parent Tanpa Mapping Student
  if (parentStudents.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Akun Belum Terhubung</Text>
        <Text style={styles.emptySubtitle}>
          Akun Anda belum memiliki data siswa terhubung. Silakan hubungi pihak sekolah/Admin.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* HEADER BANNER */}
      <View style={styles.headerCard}>
        <Text style={styles.welcomeText}>Selamat Datang,</Text>
        <Text style={styles.parentName}>{currentUser.name}</Text>
        <Text style={styles.subWelcome}>Pantau perkembangan belajar buah hati Anda.</Text>
      </View>

      {/* MULTI-CHILD SELECTOR (JIKA >1 ANAK) */}
      {parentStudents.length > 1 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Pilih Anak:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
            {parentStudents.map((student) => {
              const isSelected = student.id === selectedStudentId;
              return (
                <TouchableOpacity
                  key={student.id}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => handleSelectStudent(student.id)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {student.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {activeStudent && (
        <>
          {/* CARD 1: PROFIL ANAK */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>👤 Profil Siswa</Text>
            <View style={styles.profileRow}>
              <View style={styles.profileInfo}>
                <Text style={styles.studentName}>{activeStudent.name}</Text>
                <Text style={styles.studentDetail}>Kelas: {activeStudent.className || '-'}</Text>
                <Text style={styles.studentDetail}>
                  Periode: {selectedAcademicYear} ({selectedTerm})
                </Text>
              </View>
            </View>
          </View>

          {/* CARD 2: CATATAN OBSERVASIONS & INCIDENTS (SUB-PHASE 15.2 READ-ONLY) */}
          <View style={styles.card}>
            <View style={styles.attendanceCardHeaderRow}>
              <Text style={styles.cardHeader}>📋 Catatan Observasi & Perilaku</Text>
              {currentStudentIncidents.length > 0 && (
                <View style={styles.rateBadge}>
                  <Text style={styles.rateBadgeText}>
                    Total: {currentStudentIncidents.length} Catatan
                  </Text>
                </View>
              )}
            </View>

            {isIncidentsLoading ? (
              <ActivityIndicator size="small" color="#1E88E5" style={{ marginVertical: 12 }} />
            ) : currentStudentIncidents.length > 0 ? (
              <View style={styles.incidentList}>
                {currentStudentIncidents.map((item) => (
                  <View key={item.id} style={styles.incidentCardItem}>
                    <View style={styles.incidentHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.incidentCategoryText}>
                          📌 {item.category} • {item.date || item.createdAt.split(' ')[0]}
                        </Text>
                        <Text style={styles.incidentTeacherText}>
                          Dicatat oleh: {item.teacherName}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {renderIncidentStatusBadge(item.status)}
                        {renderPriorityBadge(item.priority)}
                      </View>
                    </View>

                    <Text style={styles.incidentDescriptionText}>{item.description}</Text>

                    {item.actionTaken ? (
                      <View style={styles.actionTakenBox}>
                        <Text style={styles.actionTakenTitle}>Tindakan Awal Guru:</Text>
                        <Text style={styles.actionTakenText}>{item.actionTaken}</Text>
                      </View>
                    ) : null}

                    {/* Follow-up Logs List */}
                    {item.followUpLogs && item.followUpLogs.length > 0 && (
                      <View style={styles.followUpSection}>
                        <Text style={styles.followUpSectionTitle}>
                          💬 Catatan Tindak Lanjut ({item.followUpLogs.length}):
                        </Text>
                        {item.followUpLogs.map((log) => (
                          <View key={log.id} style={styles.followUpLogItem}>
                            <Text style={styles.followUpLogHeader}>
                              {log.author || 'Guru'} • {log.updatedAt || log.date}
                            </Text>
                            <Text style={styles.followUpLogNote}>{log.note}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Belum ada catatan observasi atau insiden terdaftar untuk ananda.
              </Text>
            )}
          </View>

          {/* CARD 3: RINGKASAN & RIWAYAT PRESENSI (TAHAP 14.4 ENHANCED) */}
          <View style={styles.card}>
            <View style={styles.attendanceCardHeaderRow}>
              <Text style={styles.cardHeader}>📅 Kehadiran & Presensi</Text>
              {overallAttendanceSummary.attendanceRate !== null ? (
                <View style={styles.rateBadge}>
                  <Text style={styles.rateBadgeText}>
                    Kehadiran: {overallAttendanceSummary.attendanceRate}%
                  </Text>
                </View>
              ) : (
                <View style={styles.noDataBadge}>
                  <Text style={styles.noDataBadgeText}>Belum Ada Data</Text>
                </View>
              )}
            </View>

            {isAttendanceLoading ? (
              <ActivityIndicator size="small" color="#1E88E5" style={{ marginVertical: 16 }} />
            ) : (
              <>
                {/* Overall Summary Counters Grid */}
                <View style={styles.attendanceGrid}>
                  <View style={[styles.attendanceBox, { backgroundColor: '#E8F5E9' }]}>
                    <Text style={[styles.attendanceCount, { color: '#2E7D32' }]}>
                      {overallAttendanceSummary.presentCount}
                    </Text>
                    <Text style={styles.attendanceLabel}>Hadir</Text>
                  </View>

                  <View style={[styles.attendanceBox, { backgroundColor: '#F3E5F5' }]}>
                    <Text style={[styles.attendanceCount, { color: '#7B1FA2' }]}>
                      {overallAttendanceSummary.lateCount}
                    </Text>
                    <Text style={styles.attendanceLabel}>Terlambat</Text>
                  </View>

                  <View style={[styles.attendanceBox, { backgroundColor: '#FFF3E0' }]}>
                    <Text style={[styles.attendanceCount, { color: '#E65100' }]}>
                      {overallAttendanceSummary.sickCount}
                    </Text>
                    <Text style={styles.attendanceLabel}>Sakit</Text>
                  </View>

                  <View style={[styles.attendanceBox, { backgroundColor: '#E3F2FD' }]}>
                    <Text style={[styles.attendanceCount, { color: '#1565C0' }]}>
                      {overallAttendanceSummary.permissionCount}
                    </Text>
                    <Text style={styles.attendanceLabel}>Izin</Text>
                  </View>

                  <View style={[styles.attendanceBox, { backgroundColor: '#FFEBEE' }]}>
                    <Text style={[styles.attendanceCount, { color: '#C62828' }]}>
                      {overallAttendanceSummary.absentCount}
                    </Text>
                    <Text style={styles.attendanceLabel}>Alpha</Text>
                  </View>
                </View>

                {/* Monthly Grouped Attendance Log */}
                <Text style={styles.attendanceSubSectionTitle}>Riwayat Presensi Per Bulan:</Text>

                {monthlyAttendanceGroups.length > 0 ? (
                  monthlyAttendanceGroups.map((group) => (
                    <View key={group.monthKey} style={styles.monthlyGroupCard}>
                      <View style={styles.monthlyGroupHeader}>
                        <Text style={styles.monthlyGroupTitle}>{group.monthLabel}</Text>
                        <Text style={styles.monthlyGroupStats}>
                          Total: {group.summary.totalDays} Hari | Hadir: {group.summary.presentCount + group.summary.lateCount}
                        </Text>
                      </View>

                      <View style={styles.recordsList}>
                        {group.records.map((rec) => (
                          <View key={rec.id} style={styles.recordRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.recordDateText}>📅 {rec.date}</Text>
                              <Text style={styles.recordTeacherText}>Penginput: {rec.teacherName}</Text>
                            </View>
                            {renderAttendanceStatusBadge(rec.status)}
                          </View>
                        ))}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Belum ada riwayat presensi tercatat untuk siswa ini.</Text>
                )}
              </>
            )}
          </View>

          {/* CARD 4: ANALISIS PERKEMBANGAN BELAJAR (TAHAP 12.2 SECTION) */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>📊 Analisis Perkembangan Belajar</Text>
            {isHistoryLoading ? (
              <ActivityIndicator size="small" color="#1E88E5" style={{ marginVertical: 12 }} />
            ) : progressMetrics.latestAverage !== null ? (
              <View>
                {/* Metric Main Summary Box */}
                <View style={styles.analyticsMainBox}>
                  <View style={styles.analyticsColumn}>
                    <Text style={styles.analyticsLabelText}>Rerata Terkini</Text>
                    <Text style={styles.analyticsValueText}>
                      {progressMetrics.latestAverage.toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.analyticsColumnRight}>
                    <Text style={styles.analyticsLabelText}>Tren Perkembangan</Text>
                    {renderTrendBadge(
                      progressMetrics.trendDirection,
                      progressMetrics.deltaScore
                    )}
                  </View>
                </View>

                {/* Highlights Mapel Tertinggi & Terendah */}
                <View style={styles.highlightsContainer}>
                  {progressMetrics.highestSubject && (
                    <View style={[styles.highlightBox, { backgroundColor: '#F1F8E9' }]}>
                      <Text style={[styles.highlightTitle, { color: '#33691E' }]}>
                        🏆 Mapel Tertinggi
                      </Text>
                      <Text style={styles.highlightSubText} numberOfLines={1}>
                        {progressMetrics.highestSubject.subjectName}:{' '}
                        <Text style={{ fontWeight: 'bold' }}>
                          {progressMetrics.highestSubject.score}
                        </Text>
                      </Text>
                    </View>
                  )}
                  {progressMetrics.lowestSubject && (
                    <View style={[styles.highlightBox, { backgroundColor: '#FFF8E1' }]}>
                      <Text style={[styles.highlightTitle, { color: '#F57F17' }]}>
                        💡 Perlu Perhatian
                      </Text>
                      <Text style={styles.highlightSubText} numberOfLines={1}>
                        {progressMetrics.lowestSubject.subjectName}:{' '}
                        <Text style={{ fontWeight: 'bold' }}>
                          {progressMetrics.lowestSubject.score}
                        </Text>
                      </Text>
                    </View>
                  )}
                </View>

                {/* Trigger Modal Analytics Detail */}
                <TouchableOpacity
                  style={styles.analyticsDetailBtn}
                  onPress={() => setIsAnalyticsModalVisible(true)}
                >
                  <Text style={styles.analyticsDetailBtnText}>
                    📈 Lihat Analisis Detail & Tren Mapel
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                Belum ada data nilai numerik untuk menganalisis perkembangan belajar.
              </Text>
            )}
          </View>

          {/* CARD 5: CATATAN PERKEMBANGAN (NARRATIVE) */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>📝 Catatan Perkembangan Belajar</Text>
            {isLoading ? (
              <ActivityIndicator size="small" color="#2196F3" style={{ marginVertical: 12 }} />
            ) : assessments.filter((a) => a.narrative).length > 0 ? (
              assessments
                .filter((a) => a.narrative)
                .map((item) => (
                  <View key={item.id} style={styles.narrativeItem}>
                    <Text style={styles.subjectTitle}>{item.subjectName}</Text>
                    <Text style={styles.narrativeText}>"{item.narrative}"</Text>
                    {item.predicate && (
                      <Text style={styles.predicateTag}>Predikat: {item.predicate}</Text>
                    )}
                  </View>
                ))
            ) : (
              <Text style={styles.emptyText}>
                Belum ada catatan perkembangan tertulis untuk periode ini.
              </Text>
            )}
          </View>

          {/* CARD 6: RIWAYAT RAPOR & PENILAIAN (TAHAP 11.2) */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>📚 Riwayat Rapor & Penilaian</Text>
            <Text style={styles.reportSub}>
              Daftar arsip laporan hasil belajar dari berbagai periode akademik sebelumnya.
            </Text>
            {isHistoryLoading ? (
              <ActivityIndicator size="small" color="#2196F3" style={{ marginVertical: 12 }} />
            ) : historyPeriods.length > 0 ? (
              historyPeriods.map((period) => (
                <TouchableOpacity
                  key={period.periodKey}
                  style={styles.historyPeriodCard}
                  onPress={() => {
                    setSelectedHistoryPeriod(period);
                    setIsHistoryModalVisible(true);
                  }}
                >
                  <View style={styles.historyPeriodInfo}>
                    <Text style={styles.historyPeriodTitle}>
                      {period.academicYear} — {period.term}
                    </Text>
                    <Text style={styles.historyPeriodSub}>
                      Jumlah Mapel: {period.totalSubjectsCount} | Rata-rata Skor:{' '}
                      {period.averageScore !== null ? period.averageScore.toFixed(1) : '-'}
                    </Text>
                  </View>
                  <Text style={styles.historyArrow}>Detail ›</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>Belum ada riwayat penilaian.</Text>
            )}
          </View>

          {/* CARD 7: EXPORT CENTER TERPADU (SUB-PHASE 16.4) */}
          <View style={[styles.card, styles.reportCard]}>
            <Text style={styles.cardHeader}>📦 Export Center / Pusat Unduh Dokumen</Text>
            <Text style={styles.reportSub}>
              Unduh salinan dokumen resmi perkembangan belajar, rekap presensi, dan laporan perilaku ananda ({activeStudent.name}) dalam format PDF.
            </Text>

            <View style={styles.exportActionList}>
              {/* Button 1: PDF Rapor Akademik */}
              <TouchableOpacity
                style={[styles.downloadButton, isExportingAcademic && styles.downloadButtonDisabled]}
                onPress={handleDownloadPDF}
                disabled={isExportingAcademic}
              >
                {isExportingAcademic ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.downloadButtonText}>📄 Unduh Rapor Hasil Belajar PDF</Text>
                )}
              </TouchableOpacity>

              {/* Button 2: PDF Rekap Presensi */}
              <TouchableOpacity
                style={[
                  styles.downloadButton,
                  { backgroundColor: '#1E88E5' },
                  isExportingAttendance && styles.downloadButtonDisabled,
                ]}
                onPress={handleDownloadAttendancePDF}
                disabled={isExportingAttendance}
              >
                {isExportingAttendance ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.downloadButtonText}>📅 Unduh Rekap Presensi PDF</Text>
                )}
              </TouchableOpacity>

              {/* Button 3: PDF Rekap Perilaku & Insiden */}
              <TouchableOpacity
                style={[
                  styles.downloadButton,
                  { backgroundColor: '#6A1B9A' },
                  isExportingIncident && styles.downloadButtonDisabled,
                ]}
                onPress={handleDownloadIncidentPDF}
                disabled={isExportingIncident}
              >
                {isExportingIncident ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.downloadButtonText}>📋 Unduh Rekap Catatan Perilaku PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* MODAL DETAIL RIWAYAT PENILAIAN (READ-ONLY 11.2) */}
      <Modal
        visible={isHistoryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderContainer}>
              <Text style={styles.modalTitle}>Detail Rapor Riwayat</Text>
              <TouchableOpacity
                onPress={() => setIsHistoryModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedHistoryPeriod && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalSubHeader}>
                  <Text style={styles.modalAcademicText}>
                    {selectedHistoryPeriod.academicYear} ({selectedHistoryPeriod.term})
                  </Text>
                  <Text style={styles.modalStatsText}>
                    Total Mata Pelajaran: {selectedHistoryPeriod.totalSubjectsCount}
                  </Text>
                  {selectedHistoryPeriod.averageScore !== null && (
                    <Text style={styles.modalStatsText}>
                      Rata-rata Nilai: {selectedHistoryPeriod.averageScore.toFixed(1)}
                    </Text>
                  )}
                </View>

                <Text style={styles.modalSectionTitle}>Daftar Nilai & Catatan:</Text>
                {selectedHistoryPeriod.assessments.map((assessment) => (
                  <View key={assessment.id} style={styles.subjectDetailCard}>
                    <Text style={styles.modalSubjectName}>{assessment.subjectName}</Text>
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreText}>
                        Nilai: {assessment.score !== null && assessment.score !== undefined ? assessment.score : '-'}
                      </Text>
                      <Text style={styles.predicateText}>
                        Predikat: {assessment.predicate || '-'}
                      </Text>
                    </View>
                    {assessment.narrative ? (
                      <Text style={styles.modalNarrative}>"{assessment.narrative}"</Text>
                    ) : (
                      <Text style={styles.modalNoNarrative}>Belum ada catatan perkembangan.</Text>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.downloadButton, { marginTop: 16, marginBottom: 24 }]}
                  onPress={() => handleDownloadHistoryPDF(selectedHistoryPeriod)}
                >
                  <Text style={styles.downloadButtonText}>📄 Unduh PDF Rapor Periode Ini</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL ANALISIS PERKEMBANGAN BELAJAR (TAHAP 12.2 MODAL) */}
      <Modal
        visible={isAnalyticsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAnalyticsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderContainer}>
              <View>
                <Text style={styles.modalTitle}>Analisis Perkembangan Belajar</Text>
                {activeStudent && (
                  <Text style={styles.analyticsModalSub}>
                    Ananda: {activeStudent.name} ({progressMetrics.totalPeriodsEvaluated} Periode Evaluasi)
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setIsAnalyticsModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Overall Progress Section */}
              <View style={styles.analyticsModalBox}>
                <Text style={styles.modalSectionTitle}>Ringkasan Performa Akademik</Text>
                <View style={styles.scoreRowModal}>
                  <Text style={styles.modalStatText}>
                    Rerata Terkini: <Text style={{ fontWeight: 'bold' }}>{progressMetrics.latestAverage?.toFixed(1) || '-'}</Text>
                  </Text>
                  <Text style={styles.modalStatText}>
                    Rerata Lalu: <Text style={{ fontWeight: 'bold' }}>{progressMetrics.previousAverage?.toFixed(1) || '-'}</Text>
                  </Text>
                </View>
                <View style={{ marginTop: 8 }}>
                  {renderTrendBadge(progressMetrics.trendDirection, progressMetrics.deltaScore)}
                </View>
              </View>

              {/* Subject Progression List */}
              <Text style={styles.modalSectionTitle}>Perkembangan Nilai per Mata Pelajaran:</Text>

              {subjectProgressions.length > 0 ? (
                subjectProgressions.map((subj) => {
                  const latestVal = subj.latestScore ?? 0;
                  const barWidthPercent = Math.min(Math.max(latestVal, 0), 100);

                  return (
                    <View key={subj.subjectId} style={styles.subjectProgressionCard}>
                      <View style={styles.subjectCardHeader}>
                        <Text style={styles.subjectCardTitle}>{subj.subjectName}</Text>
                        {renderTrendBadge(subj.trendDirection, subj.deltaScore)}
                      </View>

                      {/* Native Visual Progress Bar */}
                      <View style={styles.progressBarBackground}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${barWidthPercent}%`,
                              backgroundColor:
                                latestVal >= 80
                                  ? '#2E7D32'
                                  : latestVal >= 70
                                  ? '#1E88E5'
                                  : '#E65100',
                            },
                          ]}
                        />
                      </View>

                      {/* Detail Text & Scores Pill Badges */}
                      <View style={styles.subjectCardFooter}>
                        <Text style={styles.subjectCardScoreText}>
                          Terkini:{' '}
                          <Text style={{ fontWeight: 'bold' }}>
                            {subj.latestScore !== null ? subj.latestScore : '-'}
                          </Text>{' '}
                          | Sebelumnya:{' '}
                          <Text style={{ fontWeight: 'bold' }}>
                            {subj.previousScore !== null ? subj.previousScore : '-'}
                          </Text>
                        </Text>
                      </View>

                      {/* Pill Badges Riwayat Kronologis */}
                      <View style={styles.historyPillsContainer}>
                        <Text style={styles.historyPillLabel}>Riwayat: </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {subj.scoresHistory.map((sh, idx) => (
                            <View key={idx} style={styles.historyPill}>
                              <Text style={styles.historyPillText}>
                                {sh.academicYear} ({sh.term}):{' '}
                                <Text style={{ fontWeight: 'bold' }}>{sh.score}</Text>
                              </Text>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>Belum ada data mata pelajaran.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F5F7FA',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  headerCard: {
    backgroundColor: '#1E88E5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  welcomeText: {
    color: '#BBDEFB',
    fontSize: 14,
  },
  parentName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  subWelcome: {
    color: '#E3F2FD',
    fontSize: 12,
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#1E88E5',
  },
  chipText: {
    fontSize: 13,
    color: '#424242',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 4,
  },
  studentDetail: {
    fontSize: 13,
    color: '#546E7A',
    marginTop: 2,
  },
  attendanceCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rateBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  rateBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  noDataBadge: {
    backgroundColor: '#ECEFF1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFD8DC',
  },
  noDataBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#607D8B',
  },
  incidentList: {
    gap: 10,
  },
  incidentCardItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  incidentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  incidentCategoryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  incidentTeacherText: {
    fontSize: 10,
    color: '#78909C',
    marginTop: 2,
  },
  incidentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  incidentBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  incidentDescriptionText: {
    fontSize: 13,
    color: '#263238',
    lineHeight: 18,
    marginBottom: 8,
  },
  actionTakenBox: {
    backgroundColor: '#FFFDE7',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FBC02D',
    marginBottom: 8,
  },
  actionTakenTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F57F17',
    marginBottom: 2,
  },
  actionTakenText: {
    fontSize: 12,
    color: '#37474F',
  },
  followUpSection: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  followUpSectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#455A64',
  },
  followUpLogItem: {
    backgroundColor: '#F5F5F5',
    padding: 6,
    borderRadius: 4,
  },
  followUpLogHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 2,
  },
  followUpLogNote: {
    fontSize: 11,
    color: '#37474F',
  },
  attendanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  attendanceBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  attendanceCount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  attendanceLabel: {
    fontSize: 10,
    color: '#455A64',
    marginTop: 2,
    fontWeight: '600',
  },
  attendanceSubSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#37474F',
    marginBottom: 8,
  },
  monthlyGroupCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  monthlyGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 6,
    marginBottom: 8,
  },
  monthlyGroupTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  monthlyGroupStats: {
    fontSize: 11,
    color: '#616161',
    fontWeight: '500',
  },
  recordsList: {
    gap: 6,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  recordDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#263238',
  },
  recordTeacherText: {
    fontSize: 10,
    color: '#78909C',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  analyticsMainBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 12,
  },
  analyticsColumn: {
    justifyContent: 'center',
  },
  analyticsColumnRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  analyticsLabelText: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 2,
  },
  analyticsValueText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E88E5',
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  highlightsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  highlightBox: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  highlightTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  highlightSubText: {
    fontSize: 12,
    color: '#37474F',
  },
  analyticsDetailBtn: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  analyticsDetailBtnText: {
    color: '#1565C0',
    fontSize: 13,
    fontWeight: 'bold',
  },
  narrativeItem: {
    backgroundColor: '#F9FBE7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#9E9D24',
  },
  subjectTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#33691E',
    marginBottom: 4,
  },
  narrativeText: {
    fontSize: 13,
    color: '#37474F',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  predicateTag: {
    fontSize: 11,
    color: '#558B2F',
    fontWeight: '600',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#90A4AE',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  reportCard: {
    borderColor: '#BBDEFB',
    borderWidth: 1,
  },
  reportSub: {
    fontSize: 13,
    color: '#546E7A',
    marginBottom: 16,
    lineHeight: 18,
  },
  exportActionList: {
    gap: 10,
  },
  downloadButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  historyPeriodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  historyPeriodInfo: {
    flex: 1,
  },
  historyPeriodTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E88E5',
    marginBottom: 2,
  },
  historyPeriodSub: {
    fontSize: 12,
    color: '#6C757D',
  },
  historyArrow: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6C757D',
    marginLeft: 8,
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
    maxHeight: '85%',
  },
  modalHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
  },
  analyticsModalSub: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6C757D',
  },
  modalSubHeader: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalAcademicText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 4,
  },
  modalStatsText: {
    fontSize: 13,
    color: '#37474F',
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 8,
  },
  subjectDetailCard: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  modalSubjectName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E88E5',
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 13,
    color: '#37474F',
    fontWeight: '600',
  },
  predicateText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  modalNarrative: {
    fontSize: 12,
    color: '#546E7A',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 16,
  },
  modalNoNarrative: {
    fontSize: 12,
    color: '#90A4AE',
    fontStyle: 'italic',
    marginTop: 4,
  },
  analyticsModalBox: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 16,
  },
  scoreRowModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalStatText: {
    fontSize: 13,
    color: '#37474F',
  },
  subjectProgressionCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  subjectCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1565C0',
    flex: 1,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  subjectCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subjectCardScoreText: {
    fontSize: 12,
    color: '#455A64',
  },
  historyPillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  historyPillLabel: {
    fontSize: 11,
    color: '#78909C',
    fontWeight: '600',
  },
  historyPill: {
    backgroundColor: '#ECEFF1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  historyPillText: {
    fontSize: 10,
    color: '#37474F',
  },
});
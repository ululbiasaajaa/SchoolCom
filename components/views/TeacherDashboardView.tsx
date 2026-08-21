import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { subscribeToAllStudentAssessments } from '../../service/assessmentService';
import {
  CategoryType,
  Incident,
  StatusType,
  Student,
  StudentAssessment,
} from '../../types/schoolcom';
import { getStatusBadgeStyle } from '../../utils/badges';
import { DateFilterType, matchesDateFilter } from '../../utils/dateParser';
import {
  AssessmentPeriodSummary,
  groupAssessmentsByPeriod,
} from '../../utils/historyHelper';

// Import Analytics Helpers (Tahap 12.1)
import {
  getStudentProgressMetrics,
  groupAssessmentsBySubject,
  TrendDirection,
} from '../../utils/analyticsHelper';

interface TeacherDashboardViewProps {
  teacherName?: string;
  teacherClasses?: string[]; // Prop dinamis daftar kelas binaan guru
  metrics: {
    totalObs: number;
    pending: number;
    followUp: number;
    resolved: number;
  };
  incidents: Incident[];
  students: Student[];
  onOpenNewIncident: () => void;
  onSelectStudent: (studentId: string) => void;
}

const CATEGORIES: ('All' | CategoryType)[] = [
  'All',
  'Observation',
  'Behavior',
  'Academic',
  'Social',
  'Incident',
  'Health',
  'Other',
];

const STATUSES: ('All' | StatusType)[] = [
  'All',
  'Pending',
  'Follow-up',
  'Resolved',
];

const DATE_FILTERS: { label: string; value: DateFilterType }[] = [
  { label: 'Semua Tanggal', value: 'All' },
  { label: 'Hari Ini', value: 'Today' },
  { label: '7 Hari Terakhir', value: 'Last7Days' },
  { label: '30 Hari Terakhir', value: 'Last30Days' },
];

export default function TeacherDashboardView({
  teacherName = 'Guru',
  teacherClasses = [],
  metrics,
  incidents,
  students,
  onOpenNewIncident,
  onSelectStudent,
}: TeacherDashboardViewProps) {
  // Existing Filter States
  const [selectedStatus, setSelectedStatus] = useState<'All' | StatusType>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | CategoryType>('All');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterType>('All');

  // Tahap 11.3 & 12.3: Single Source of Truth History & Analytics States
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState<Student | null>(null);
  const [allHistoryAssessments, setAllHistoryAssessments] = useState<StudentAssessment[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [selectedHistoryPeriod, setSelectedHistoryPeriod] = useState<AssessmentPeriodSummary | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Tahap 12.3: State Segmented Tab Modal ('history' | 'analytics')
  const [activeModalTab, setActiveModalTab] = useState<'history' | 'analytics'>('history');

  // Teks subtitle kelas dinamis
  const displayClassesText = useMemo(() => {
    if (teacherClasses && teacherClasses.length > 0) {
      return teacherClasses.join(' • ');
    }
    const uniqueClasses = Array.from(new Set(students.map((s) => s.className).filter(Boolean)));
    return uniqueClasses.length > 0 ? uniqueClasses.join(' • ') : 'Kelas Binaan';
  }, [teacherClasses, students]);

  // Subscription Lifecycle Manager khusus History & Analytics Siswa
  useEffect(() => {
    if (!selectedHistoryStudent || !isHistoryModalOpen) {
      setAllHistoryAssessments([]);
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);

    const unsubscribe = subscribeToAllStudentAssessments(
      selectedHistoryStudent.id,
      (fetchedHistory) => {
        setAllHistoryAssessments(fetchedHistory);
        setIsHistoryLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedHistoryStudent, isHistoryModalOpen]);

  // Grouping Data History Lintas Periode Menggunakan Helper 11.1
  const historyPeriods = useMemo(() => {
    return groupAssessmentsByPeriod(allHistoryAssessments);
  }, [allHistoryAssessments]);

  // Agregasi Analytics Menggunakan Helper 12.1 (Tahap 12.3)
  const progressMetrics = useMemo(() => {
    return getStudentProgressMetrics(historyPeriods);
  }, [historyPeriods]);

  const subjectProgressions = useMemo(() => {
    return groupAssessmentsBySubject(allHistoryAssessments);
  }, [allHistoryAssessments]);

  // Handler Buka History & Analytics Modal
  const handleOpenHistoryModal = (student: Student) => {
    setSelectedHistoryStudent(student);
    setSelectedHistoryPeriod(null);
    setActiveModalTab('history'); // MANDATORY: Default ke tab history
    setIsHistoryModalOpen(true);
  };

  // Handler Tutup History & Analytics Modal
  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedHistoryStudent(null);
    setSelectedHistoryPeriod(null);
    setActiveModalTab('history'); // MANDATORY: Reset tab state saat modal ditutup
  };

  // Helper Renderer Badge Trend Delta (Tahap 12.3)
  const renderTrendBadge = (direction: TrendDirection, delta: number | null) => {
    switch (direction) {
      case 'up':
        return (
          <View style={[styles.trendBadge, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[styles.trendBadgeText, { color: '#059669' }]}>
              ▲ +{delta !== null ? delta.toFixed(1) : ''}
            </Text>
          </View>
        );
      case 'down':
        return (
          <View style={[styles.trendBadge, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.trendBadgeText, { color: '#DC2626' }]}>
              ▼ {delta !== null ? delta.toFixed(1) : ''}
            </Text>
          </View>
        );
      case 'stable':
        return (
          <View style={[styles.trendBadge, { backgroundColor: '#DBEAFE' }]}>
            <Text style={[styles.trendBadgeText, { color: '#2563EB' }]}>
              ▶ 0.0 (Konstan)
            </Text>
          </View>
        );
      case 'initial':
      default:
        return (
          <View style={[styles.trendBadge, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[styles.trendBadgeText, { color: '#4B5563' }]}>
              ⚪ Periode Perdana
            </Text>
          </View>
        );
    }
  };

  // Filter & Sorting Incident (Latest First)
  const filteredIncidents = useMemo(() => {
    let result = [...incidents];

    if (selectedStatus !== 'All') {
      result = result.filter((i) => {
        const rawStatus = (i.status || '').toString();
        const isValidStatus = ['Pending', 'Follow-up', 'Resolved'].includes(rawStatus);
        const safeStatus = isValidStatus ? rawStatus : 'Pending';
        return safeStatus === selectedStatus;
      });
    }

    if (selectedCategory !== 'All') {
      result = result.filter((i) => i.category === selectedCategory);
    }

    if (selectedDateFilter !== 'All') {
      result = result.filter((i) => matchesDateFilter(i.createdAt, selectedDateFilter));
    }

    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [incidents, selectedStatus, selectedCategory, selectedDateFilter]);

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Selamat Pagi, {teacherName} 👋</Text>
        <Text style={styles.welcomeSub}>{displayClassesText}</Text>
      </View>

      {/* Ringkasan Metrics */}
      <Text style={styles.sectionHeader}>Ringkasan Catatan Siswa</Text>
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { backgroundColor: '#F8FAFC' }]}>
          <Text style={styles.metricVal}>{metrics.totalObs}</Text>
          <Text style={styles.metricLbl}>Total Catatan</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.metricVal, { color: '#D97706' }]}>{metrics.pending}</Text>
          <Text style={styles.metricLbl}>🟡 Pending</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.metricVal, { color: '#2563EB' }]}>{metrics.followUp}</Text>
          <Text style={styles.metricLbl}>🔵 Follow-Up</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.metricVal, { color: '#059669' }]}>{metrics.resolved}</Text>
          <Text style={styles.metricLbl}>🟢 Resolved</Text>
        </View>
      </View>

      {/* Tombol Buat Catatan */}
      <TouchableOpacity style={styles.primaryBtn} onPress={onOpenNewIncident}>
        <Text style={styles.primaryBtnText}>+ Buat Catatan / Observasi Baru</Text>
      </TouchableOpacity>

      {/* SECTION DAFTAR SISWA (TAHAP 11.3 INTEGRATION POINT) */}
      {students && students.length > 0 && (
        <View style={styles.studentsSection}>
          <Text style={styles.sectionHeader}>Daftar Siswa Kelas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.studentChipScroll}>
            {students.map((student) => (
              <View key={student.id} style={styles.studentCardContainer}>
                <TouchableOpacity
                  style={styles.studentCard}
                  onPress={() => onSelectStudent(student.id)}
                >
                  <Text style={styles.studentAvatar}>{student.avatar || '👦'}</Text>
                  <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.historyBtn}
                  onPress={() => handleOpenHistoryModal(student)}
                >
                  <Text style={styles.historyBtnText}>📚 Riwayat & Progress</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filter Section */}
      <Text style={styles.sectionHeader}>Aktivitas Terkini</Text>

      {/* Filter Tanggal Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {DATE_FILTERS.map((dateFilter) => {
          const isActive = selectedDateFilter === dateFilter.value;
          return (
            <TouchableOpacity
              key={dateFilter.value}
              style={[styles.filterChip, isActive && styles.filterChipActiveDate]}
              onPress={() => setSelectedDateFilter(dateFilter.value)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                📅 {dateFilter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Filter Status Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {STATUSES.map((status) => {
          const isActive = selectedStatus === status;
          return (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {status === 'All' ? 'Semua Status' : status}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Filter Kategori Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, isActive && styles.filterChipActiveCategory]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {cat === 'All' ? 'Semua Kategori' : cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Incident List / Empty State */}
      {filteredIncidents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Tidak Ada Catatan Siswa</Text>
          <Text style={styles.emptySubText}>
            Tidak ada laporan yang cocok dengan filter yang Anda pilih.
          </Text>
        </View>
      ) : (
        filteredIncidents.map((item) => {
          const student = students.find((s) => s.id === item.studentId);
          const rawStatus = (item.status || '').toString();
          const isValidStatus = ['Pending', 'Follow-up', 'Resolved'].includes(rawStatus);
          const safeStatus: StatusType = isValidStatus ? (rawStatus as StatusType) : 'Pending';

          const badge = getStatusBadgeStyle(safeStatus);

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => onSelectStudent(item.studentId)}
            >
              <View style={styles.cardRowBetween}>
                <Text style={styles.studentNameCard}>
                  {student?.avatar || '👦'} {student?.name || 'Siswa'}
                </Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {badge.symbol} {safeStatus}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>{item.category} • {item.createdAt}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            </TouchableOpacity>
          );
        })
      )}

      {/* MODAL RIWAYAT & ANALISIS PROGRESS SISWA (TAHAP 11.3 & 12.3) */}
      <Modal
        visible={isHistoryModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseHistoryModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeaderContainer}>
              <View>
                <Text style={styles.modalTitle}>Evaluasi Siswa</Text>
                {selectedHistoryStudent && (
                  <Text style={styles.modalSubtitle}>
                    {selectedHistoryStudent.avatar || '👦'} {selectedHistoryStudent.name}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={handleCloseHistoryModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Segmented Control / Tab Switcher (12.3) */}
            <View style={styles.tabBarContainer}>
              <TouchableOpacity
                style={[styles.tabBarItem, activeModalTab === 'history' && styles.tabBarItemActive]}
                onPress={() => {
                  setSelectedHistoryPeriod(null);
                  setActiveModalTab('history');
                }}
              >
                <Text style={[styles.tabBarText, activeModalTab === 'history' && styles.tabBarTextActive]}>
                  📚 Riwayat Rapor
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBarItem, activeModalTab === 'analytics' && styles.tabBarItemActive]}
                onPress={() => setActiveModalTab('analytics')}
              >
                <Text style={[styles.tabBarText, activeModalTab === 'analytics' && styles.tabBarTextActive]}>
                  📊 Analisis Progress
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content Loader */}
            {isHistoryLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.loadingText}>Memuat data siswa...</Text>
              </View>
            ) : activeModalTab === 'history' ? (
              /* TAB 1: RIWAYAT RAPOR (11.3 - UNTOUCHED) */
              selectedHistoryPeriod ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setSelectedHistoryPeriod(null)}
                  >
                    <Text style={styles.backButtonText}>‹ Kembali ke Daftar Periode</Text>
                  </TouchableOpacity>

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
                </ScrollView>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {historyPeriods.length > 0 ? (
                    historyPeriods.map((period) => (
                      <TouchableOpacity
                        key={period.periodKey}
                        style={styles.historyPeriodCard}
                        onPress={() => setSelectedHistoryPeriod(period)}
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
                    <View style={styles.emptyHistoryContainer}>
                      <Text style={styles.emptyText}>Belum ada riwayat penilaian untuk siswa ini.</Text>
                    </View>
                  )}
                </ScrollView>
              )
            ) : (
              /* TAB 2: ANALISIS PROGRESS & TREN (12.3) */
              <ScrollView showsVerticalScrollIndicator={false}>
                {progressMetrics.latestAverage !== null ? (
                  <View>
                    {/* Overall Progress Summary Card */}
                    <View style={styles.analyticsModalBox}>
                      <Text style={styles.modalSectionTitle}>Ringkasan Performa Akademik</Text>
                      <View style={styles.scoreRowModal}>
                        <Text style={styles.modalStatText}>
                          Rerata Terkini: <Text style={{ fontWeight: 'bold' }}>{progressMetrics.latestAverage.toFixed(1)}</Text>
                        </Text>
                        <Text style={styles.modalStatText}>
                          Rerata Lalu: <Text style={{ fontWeight: 'bold' }}>{progressMetrics.previousAverage?.toFixed(1) || '-'}</Text>
                        </Text>
                      </View>
                      <View style={{ marginTop: 8 }}>
                        {renderTrendBadge(progressMetrics.trendDirection, progressMetrics.deltaScore)}
                      </View>
                    </View>

                    {/* Highlights Mapel */}
                    <View style={styles.highlightsContainer}>
                      {progressMetrics.highestSubject && (
                        <View style={[styles.highlightBox, { backgroundColor: '#D1FAE5' }]}>
                          <Text style={[styles.highlightTitle, { color: '#059669' }]}>
                            🏆 Mapel Terunggul
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
                        <View style={[styles.highlightBox, { backgroundColor: '#FEF3C7' }]}>
                          <Text style={[styles.highlightTitle, { color: '#D97706' }]}>
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

                    {/* Subject Progression Cards */}
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
                                        ? '#059669'
                                        : latestVal >= 70
                                        ? '#2563EB'
                                        : '#D97706',
                                  },
                                ]}
                              />
                            </View>

                            {/* Detail Text */}
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
                  </View>
                ) : (
                  <View style={styles.emptyHistoryContainer}>
                    <Text style={styles.emptyText}>
                      Belum ada data nilai numerik untuk menganalisis perkembangan belajar siswa ini.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    padding: 16,
  },
  welcomeCard: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  welcomeSub: {
    color: '#93C5FD',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  metricLbl: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  studentsSection: {
    marginBottom: 8,
  },
  studentChipScroll: {
    flexDirection: 'row',
  },
  studentCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    width: 130,
  },
  studentCard: {
    alignItems: 'center',
    width: '100%',
  },
  studentAvatar: {
    fontSize: 24,
    marginBottom: 4,
  },
  studentName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  historyBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    width: '100%',
    alignItems: 'center',
  },
  historyBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },
  filterScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterChipActiveCategory: {
    backgroundColor: '#059669',
  },
  filterChipActiveDate: {
    backgroundColor: '#7C3AED',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentNameCard: {
    fontWeight: '700',
    fontSize: 14,
    color: '#111827',
  },
  cardMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#374151',
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
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptySubText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
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
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
  },
  tabBarItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBarItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  tabBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabBarTextActive: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  modalSubHeader: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalAcademicText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 4,
  },
  modalStatsText: {
    fontSize: 13,
    color: '#1F2937',
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subjectDetailCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalSubjectName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  predicateText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  modalNarrative: {
    fontSize: 12,
    color: '#4B5563',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 16,
  },
  modalNoNarrative: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  historyPeriodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyPeriodInfo: {
    flex: 1,
  },
  historyPeriodTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 2,
  },
  historyPeriodSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  historyArrow: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6B7280',
    marginLeft: 8,
  },
  emptyHistoryContainer: {
    padding: 24,
    alignItems: 'center',
  },
  analyticsModalBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  scoreRowModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalStatText: {
    fontSize: 13,
    color: '#374151',
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
    marginBottom: 16,
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
    color: '#374151',
  },
  subjectProgressionCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#2563EB',
    flex: 1,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#E5E7EB',
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
    color: '#4B5563',
  },
  historyPillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  historyPillLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  historyPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  historyPillText: {
    fontSize: 10,
    color: '#374151',
  },
});
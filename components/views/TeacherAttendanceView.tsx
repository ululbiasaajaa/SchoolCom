import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  AttendanceRecord,
  AttendanceStatus,
  saveAttendanceBatch,
  subscribeToAttendanceByClass,
} from '../../service/attendanceService';
import { notifyParentOnAttendance } from '../../service/pushNotificationService';
import { Student } from '../../types/schoolcom';

interface TeacherAttendanceViewProps {
  students: Student[];
  teacherClasses?: string[]; // Daftar kelas binaan dari user.classes
  teacherName?: string;
}

const STATUS_OPTIONS: { label: string; value: AttendanceStatus; color: string }[] = [
  { label: 'Hadir', value: 'Present', color: '#059669' },
  { label: 'Sakit', value: 'Sick', color: '#D97706' },
  { label: 'Izin', value: 'Permission', color: '#2563EB' },
  { label: 'Alpha', value: 'Absent', color: '#DC2626' },
  { label: 'Terlambat', value: 'Late', color: '#7C3AED' },
];

export default function TeacherAttendanceView({
  students,
  teacherClasses = [],
  teacherName = 'Guru',
}: TeacherAttendanceViewProps) {
  // Tanggal default hari ini format YYYY-MM-DD lokal
  const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedClass, setSelectedClass] = useState<string>(
    teacherClasses.length > 0 ? teacherClasses[0] : ''
  );

  // Baseline State (dari Firestore / setelah save) vs Current State (edit lokal)
  const [initialAttendanceMap, setInitialAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Ref penampung students untuk menghindari spurious re-subscription
  const studentsRef = useRef<Student[]>(students);
  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  // Sync default selectedClass ketika teacherClasses dimuat/berubah
  useEffect(() => {
    if (teacherClasses.length > 0 && !teacherClasses.includes(selectedClass)) {
      setSelectedClass(teacherClasses[0]);
    }
  }, [teacherClasses]);

  // Filter siswa yang hanya termasuk di kelas yang sedang dipilih
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter((s) => s.className === selectedClass);
  }, [students, selectedClass]);

  // Helper Murni: Membandingkan apakah ada perubahan antara currentMap dan initialMap
  const checkIsDirty = (
    currentMap: Record<string, AttendanceStatus>,
    baseMap: Record<string, AttendanceStatus>
  ): boolean => {
    const keysCurrent = Object.keys(currentMap);
    const keysBase = Object.keys(baseMap);

    if (keysCurrent.length !== keysBase.length) return true;

    for (const key of keysCurrent) {
      if (currentMap[key] !== baseMap[key]) {
        return true;
      }
    }
    return false;
  };

  const isDirty = useMemo(() => {
    return checkIsDirty(attendanceMap, initialAttendanceMap);
  }, [attendanceMap, initialAttendanceMap]);

  // Subscribe ke data absensi terisolasi MURNI per KELAS & TANGGAL
  useEffect(() => {
    if (!selectedClass) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToAttendanceByClass(
      selectedDate,
      selectedClass,
      (records: AttendanceRecord[]) => {
        const map: Record<string, AttendanceStatus> = {};

        // Jika ada data tersimpan di Firestore, pakai data tersebut
        records.forEach((rec) => {
          map[rec.studentId] = rec.status;
        });

        // Membaca students dari Ref agar useEffect bebas dari dependency 'students'
        const currentClassStudents = studentsRef.current.filter(
          (s) => s.className === selectedClass
        );
        currentClassStudents.forEach((s) => {
          if (!map[s.id]) {
            map[s.id] = 'Present';
          }
        });

        // Set baseline & current map bersamaan saat data pertama/terbaru masuk dari Firestore
        setInitialAttendanceMap(map);
        setAttendanceMap(map);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedDate, selectedClass]);

  // Handler Pindah Kelas dengan Guard Warning
  const handleClassChange = (targetClass: string) => {
    if (targetClass === selectedClass) return;

    if (isDirty) {
      Alert.alert(
        'Ada Perubahan Belum Disimpan',
        'Jika Anda melanjutkan, perubahan attendance yang belum disimpan pada kelas ini akan hilang.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Lanjutkan',
            style: 'destructive',
            onPress: () => {
              setSelectedClass(targetClass);
            },
          },
        ]
      );
    } else {
      setSelectedClass(targetClass);
    }
  };

  // Handler Pindah Tanggal dengan Guard Warning
  const handleDateChange = (targetDate: string) => {
    if (targetDate === selectedDate) return;

    if (isDirty) {
      Alert.alert(
        'Ada Perubahan Belum Disimpan',
        'Jika Anda melanjutkan, perubahan attendance yang belum disimpan pada tanggal ini akan hilang.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Lanjutkan',
            style: 'destructive',
            onPress: () => {
              setSelectedDate(targetDate);
            },
          },
        ]
      );
    } else {
      setSelectedDate(targetDate);
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  // Quick Action: Set semua siswa di kelas aktif menjadi 'Present'
  const handleMarkAllPresent = () => {
    const updatedMap = { ...attendanceMap };
    filteredStudents.forEach((s) => {
      updatedMap[s.id] = 'Present';
    });
    setAttendanceMap(updatedMap);
  };

  const handleSave = async () => {
    if (!selectedClass) {
      Alert.alert('Akses Ditolak', 'Anda belum memilih kelas binaan.');
      return;
    }

    if (filteredStudents.length === 0) {
      Alert.alert('Peringatan', 'Tidak ada data siswa untuk diabsensi pada kelas ini.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const updatedAtStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Pastikan className dijamin terisi dengan selectedClass agar lolos validasi Firestore Rules
      const recordsToSave = filteredStudents.map((s) => ({
        studentId: s.id,
        studentName: s.name,
        className: s.className || selectedClass,
        status: attendanceMap[s.id] || 'Present',
        teacherName,
        updatedAt: updatedAtStr,
      }));

      await saveAttendanceBatch(recordsToSave, selectedDate);

      // TRIGGER PUSH NOTIFICATIONS EVT-03 KHUSUS SISWA YANG TIDAK HADIR / TERLAMBAT
      recordsToSave.forEach((rec) => {
        if (rec.status !== 'Present') {
          const statusOpt = STATUS_OPTIONS.find((opt) => opt.value === rec.status);
          const statusLabel = statusOpt ? statusOpt.label : rec.status;

          notifyParentOnAttendance(
            rec.studentId,
            rec.studentName,
            statusLabel,
            selectedDate
          ).catch((err) => console.warn('Gagal memicu push notifikasi presensi:', err));
        }
      });

      // Update baseline state ke current state terbaru agar isDirty kembali false
      setInitialAttendanceMap({ ...attendanceMap });
      Alert.alert('Sukses', `Absensi kelas ${selectedClass} tanggal ${selectedDate} berhasil disimpan!`);
    } catch (error: unknown) {
      console.error('Error saving attendance:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan absensi ke Firestore. Pastikan Anda memiliki akses ke kelas ini.');
    } finally {
      setIsSaving(false);
    }
  };

  // EDGE CASE 1: Guru Belum Memiliki Kelas Binaan
  if (teacherClasses.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Belum Ada Kelas Binaan</Text>
          <Text style={styles.emptyText}>
            Anda belum ditugaskan mengampu kelas mana pun. Silakan hubungi Admin Sekolah untuk melakukan alokasi kelas binaan Anda.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Banner / Header */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>📅 Absensi Siswa Harian</Text>
        <Text style={styles.headerSub}>
          Tanggal: {selectedDate} • Penginput: {teacherName}
        </Text>
      </View>

      {/* Class Selector Row (Jika mengampu lebih dari 1 kelas) */}
      {teacherClasses.length > 1 && (
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorLabel}>Pilih Kelas Binaan:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {teacherClasses.map((cls) => {
              const isActive = selectedClass === cls;
              return (
                <TouchableOpacity
                  key={cls}
                  style={[styles.classChip, isActive && styles.classChipActive]}
                  onPress={() => handleClassChange(cls)}
                >
                  <Text style={[styles.classChipText, isActive && styles.classChipTextActive]}>
                    🏫 {cls}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Sub-Header & Quick Action Button */}
      <View style={styles.actionRow}>
        <Text style={styles.classTitleText}>
          {selectedClass} ({filteredStudents.length} Siswa)
        </Text>
        <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllPresent}>
          <Text style={styles.markAllBtnText}>✓ Tandai Semua Hadir</Text>
        </TouchableOpacity>
      </View>

      {/* List Siswa */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Memuat data absensi...</Text>
        </View>
      ) : filteredStudents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Belum ada data siswa terdaftar di {selectedClass}.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {filteredStudents.map((student) => {
            const currentStatus = attendanceMap[student.id] || 'Present';

            return (
              <View key={student.id} style={styles.studentCard}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>
                    {student.avatar || '👦'} {student.name}
                  </Text>
                  <Text style={styles.studentClass}>{student.className}</Text>
                </View>

                {/* Status Chips Selector */}
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected = currentStatus === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.statusChip,
                          isSelected && { backgroundColor: opt.color, borderColor: opt.color },
                        ]}
                        onPress={() => handleStatusChange(student.id, opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            isSelected && styles.statusChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Tombol Simpan Absensi */}
      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={[styles.saveBtn, (isSaving || filteredStudents.length === 0) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving || filteredStudents.length === 0}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>
              💾 Simpan Absensi ({filteredStudents.length} Siswa) {isDirty ? '• (Ada Edit)' : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  headerCard: {
    backgroundColor: '#2563EB',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
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
  selectorContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  classChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  classChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  classChipTextActive: {
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  classTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  markAllBtn: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  markAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  studentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  studentClass: {
    fontSize: 11,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footerContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
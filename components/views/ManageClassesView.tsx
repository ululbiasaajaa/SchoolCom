import React, { useEffect, useState } from 'react';
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

import { subscribeToAllUsers } from '../../service/adminService';
import { createClass, setHomeroomTeacher, subscribeToClasses } from '../../service/classService';
import {
  backfillSchoolIdOnExistingData,
  migrateClassNamesToClasses,
} from '../../service/migrationService';
import { EducationLevel, SchoolClass, User } from '../../types/schoolcom';

const EDUCATION_LEVELS: EducationLevel[] = ['TK', 'SD', 'SMP', 'SMA'];

const LEVEL_BADGE_COLOR: Record<EducationLevel, { bg: string; text: string }> = {
  TK: { bg: '#FEF3C7', text: '#D97706' },
  SD: { bg: '#DBEAFE', text: '#2563EB' },
  SMP: { bg: '#E0E7FF', text: '#4338CA' },
  SMA: { bg: '#FCE7F3', text: '#BE185D' },
};

export default function ManageClassesView() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [isBackfillingSchoolId, setIsBackfillingSchoolId] = useState<boolean>(false);

  // Daftar Guru (buat picker Wali Kelas)
  const [teachers, setTeachers] = useState<User[]>([]);

  // Modal Atur Wali Kelas
  const [classForHomeroomEdit, setClassForHomeroomEdit] = useState<SchoolClass | null>(null);
  const [isAssigningHomeroom, setIsAssigningHomeroom] = useState(false);

  // Form Tambah Kelas
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState<EducationLevel>('TK');
  const [newClassYear, setNewClassYear] = useState('2026/2027');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToClasses((fetchedClasses) => {
      setClasses(fetchedClasses);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe Daftar Guru buat Picker Wali Kelas
  useEffect(() => {
    const unsubscribe = subscribeToAllUsers((fetchedUsers) => {
      setTeachers(fetchedUsers.filter((u) => u.role === 'teacher'));
    });
    return () => unsubscribe();
  }, []);

  // Handler Assign/Ganti Wali Kelas
  const handleAssignHomeroom = async (teacherUid: string | null) => {
    if (!classForHomeroomEdit) return;

    setIsAssigningHomeroom(true);
    try {
      await setHomeroomTeacher(classForHomeroomEdit.id, teacherUid);
      setClassForHomeroomEdit(null);
    } catch (error) {
      console.error('Error assigning homeroom teacher:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat mengatur wali kelas.');
    } finally {
      setIsAssigningHomeroom(false);
    }
  };

  // Helper cari nama guru dari uid, buat ditampilkan di kartu kelas
  const getTeacherName = (uid?: string): string | null => {
    if (!uid) return null;
    const found = teachers.find((t) => (t.uid || (t as any).id) === uid);
    return found ? found.name : uid; // Fallback nampilin UID mentah kalau gurunya udah gak ada di list
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) {
      Alert.alert('Form Belum Lengkap', 'Nama kelas wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createClass({
        name: newClassName.trim(),
        educationLevel: newClassLevel,
        academicYear: newClassYear.trim(),
      });
      setIsAddModalOpen(false);
      setNewClassName('');
      setNewClassLevel('TK');
      Alert.alert('Sukses', 'Kelas baru berhasil ditambahkan.');
    } catch (error) {
      console.error('Error creating class:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menambahkan kelas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Migrasi Data Lama (Phase 22) — sekali-jalan, aman dipanggil ulang (idempotent),
  // tapi tetap minta konfirmasi dulu karena ini operasi tulis massal ke database.
  const handleRunMigration = () => {
    Alert.alert(
      'Migrasi Data Kelas Lama',
      'Ini akan membaca semua data siswa & guru yang masih pakai nama kelas lama (teks bebas), lalu membuat entri "classes" yang sesuai dan menautkannya. Data lama TIDAK akan dihapus/diubah. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Jalankan Migrasi',
          onPress: async () => {
            setIsMigrating(true);
            try {
              const result = await migrateClassNamesToClasses({
                defaultEducationLevel: 'TK',
                defaultAcademicYear: '2026/2027',
              });

              let message =
                `Kelas baru dibuat: ${result.classesCreated}\n` +
                `Kelas sudah ada sebelumnya: ${result.classesAlreadyExisted}\n` +
                `Siswa ter-update: ${result.studentsUpdated}\n` +
                `Guru ter-update: ${result.teachersUpdated}`;

              if (result.unmatchedClassNames.length > 0) {
                message += `\n\n⚠️ Nama kelas guru yang tidak ketemu siswa manapun: ${result.unmatchedClassNames.join(', ')}`;
              }

              message +=
                '\n\nPENTING: Cek satu-satu kelas baru di bawah — educationLevel & tahun ajarannya masih nilai default, koreksi manual kalau ada yang beda.';

              Alert.alert('Migrasi Selesai', message);
            } catch (error) {
              console.error('Error running migration:', error);
              Alert.alert('Gagal', 'Terjadi kesalahan saat menjalankan migrasi.');
            } finally {
              setIsMigrating(false);
            }
          },
        },
      ]
    );
  };

  // Fondasi Multi-Sekolah: Backfill schoolId ke data lama
  const handleBackfillSchoolId = () => {
    Alert.alert(
      'Stempel schoolId ke Data Lama',
      'Ini akan menandai SEMUA data yang sudah ada sekarang (siswa, kelas, guru, nilai, presensi, dst) sebagai milik sekolah ini — persiapan fondasi kalau nanti ada sekolah lain yang pakai SchoolCom juga. Data yang SUDAH punya schoolId dilewati (aman dijalankan berkali-kali). Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Jalankan',
          onPress: async () => {
            setIsBackfillingSchoolId(true);
            try {
              const result = await backfillSchoolIdOnExistingData();
              const detailLines = Object.entries(result.perCollection)
                .map(([col, count]) => `- ${col}: ${count}`)
                .join('\n');
              Alert.alert(
                'Selesai',
                `Total ${result.totalStamped} dokumen distempel schoolId.\n\n${detailLines}`
              );
            } catch (error) {
              console.error('Error backfilling schoolId:', error);
              Alert.alert('Gagal', 'Terjadi kesalahan saat menjalankan proses ini.');
            } finally {
              setIsBackfillingSchoolId(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.tabContentFlex}>
      <View style={styles.actionHeaderRow}>
        <Text style={styles.sectionHeader}>Manajemen Kelas</Text>
        <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setIsAddModalOpen(true)}>
          <Text style={styles.primaryActionBtnText}>+ Tambah Kelas</Text>
        </TouchableOpacity>
      </View>

      {/* Tombol Migrasi — cuma relevan sekali di awal, tapi dibiarkan visible & aman
          dipencet berkali-kali (idempotent) kalau-kalau ada data lama yang kelewat */}
      <TouchableOpacity
        style={[styles.migrationBtn, isMigrating && styles.migrationBtnDisabled]}
        onPress={handleRunMigration}
        disabled={isMigrating}
      >
        {isMigrating ? (
          <ActivityIndicator color="#2563EB" size="small" />
        ) : (
          <Text style={styles.migrationBtnText}>🔄 Migrasi Data Kelas Lama (dari nama kelas siswa/guru)</Text>
        )}
      </TouchableOpacity>

      {/* Fondasi Multi-Sekolah: stempel schoolId ke data lama — jalankan SETELAH
          migrasi kelas di atas, dan idealnya cuma sekali (tapi aman diulang) */}
      <TouchableOpacity
        style={[styles.backfillBtn, isBackfillingSchoolId && styles.migrationBtnDisabled]}
        onPress={handleBackfillSchoolId}
        disabled={isBackfillingSchoolId}
      >
        {isBackfillingSchoolId ? (
          <ActivityIndicator color="#7C3AED" size="small" />
        ) : (
          <Text style={styles.backfillBtnText}>🏷️ Stempel schoolId ke Semua Data Lama</Text>
        )}
      </TouchableOpacity>

      {isLoading ? (
        <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 24 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 8 }}>
          {classes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Belum ada kelas terdaftar.</Text>
              <Text style={styles.emptySubText}>
                Tambah manual lewat tombol di atas, atau jalankan migrasi kalau sudah ada data siswa lama.
              </Text>
            </View>
          ) : (
            classes.map((c) => {
              const badgeColor = LEVEL_BADGE_COLOR[c.educationLevel] || LEVEL_BADGE_COLOR.TK;
              return (
                <View key={c.id} style={styles.classCard}>
                  <View style={styles.cardRowBetween}>
                    <Text style={styles.className}>{c.name}</Text>
                    <View style={[styles.levelBadge, { backgroundColor: badgeColor.bg }]}>
                      <Text style={[styles.levelBadgeText, { color: badgeColor.text }]}>
                        {c.educationLevel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.classMeta}>Tahun Ajaran: {c.academicYear}</Text>
                  {c.homeroomTeacherId ? (
                    <Text style={styles.classMeta}>Wali Kelas: {getTeacherName(c.homeroomTeacherId)}</Text>
                  ) : (
                    <Text style={styles.classMetaMuted}>Wali kelas belum diatur</Text>
                  )}
                  <TouchableOpacity
                    style={styles.assignHomeroomBtn}
                    onPress={() => setClassForHomeroomEdit(c)}
                  >
                    <Text style={styles.assignHomeroomBtnText}>✏️ Atur Wali Kelas</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* MODAL: TAMBAH KELAS BARU */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tambah Kelas Baru</Text>

            <Text style={styles.inputLabel}>Nama Kelas:</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Contoh: Kelas TK-A"
              value={newClassName}
              onChangeText={setNewClassName}
            />

            <Text style={styles.inputLabel}>Jenjang Pendidikan:</Text>
            <View style={styles.levelSelectorRow}>
              {EDUCATION_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[styles.levelSelectBtn, newClassLevel === level && styles.levelSelectBtnActive]}
                  onPress={() => setNewClassLevel(level)}
                >
                  <Text
                    style={[
                      styles.levelSelectBtnText,
                      newClassLevel === level && styles.levelSelectBtnTextActive,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Tahun Ajaran:</Text>
            <TextInput
              style={styles.formInput}
              placeholder="2026/2027"
              value={newClassYear}
              onChangeText={setNewClassYear}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAddModalOpen(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddClass} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Simpan Kelas</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: ATUR WALI KELAS */}
      <Modal
        visible={classForHomeroomEdit !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setClassForHomeroomEdit(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Atur Wali Kelas</Text>
            {classForHomeroomEdit && (
              <Text style={styles.modalSubtitle}>{classForHomeroomEdit.name}</Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320, marginTop: 8 }}>
              {isAssigningHomeroom ? (
                <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 16 }} />
              ) : teachers.length === 0 ? (
                <Text style={styles.emptyText}>
                  Belum ada guru terdaftar. Tambah guru dulu di tab "User".
                </Text>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.teacherOptionRow}
                    onPress={() => handleAssignHomeroom(null)}
                  >
                    <Text style={styles.teacherOptionText}>— Kosongkan Wali Kelas —</Text>
                  </TouchableOpacity>
                  {teachers.map((t) => {
                    const uid = t.uid || (t as any).id;
                    const isCurrent = classForHomeroomEdit?.homeroomTeacherId === uid;
                    return (
                      <TouchableOpacity
                        key={uid}
                        style={[styles.teacherOptionRow, isCurrent && styles.teacherOptionRowActive]}
                        onPress={() => handleAssignHomeroom(uid)}
                      >
                        <Text
                          style={[
                            styles.teacherOptionText,
                            isCurrent && styles.teacherOptionTextActive,
                          ]}
                        >
                          {isCurrent ? '✓ ' : ''}
                          {t.name} ({t.email})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 16 }]}
              onPress={() => setClassForHomeroomEdit(null)}
            >
              <Text style={styles.cancelBtnText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  assignHomeroomBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assignHomeroomBtnText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  teacherOptionRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  teacherOptionRowActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  teacherOptionText: {
    fontSize: 13,
    color: '#374151',
  },
  teacherOptionTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  tabContentFlex: {
    flex: 1,
    padding: 16,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  primaryActionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  backfillBtn: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  backfillBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
    textAlign: 'center',
  },
  migrationBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  migrationBtnDisabled: {
    opacity: 0.6,
  },
  migrationBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    textAlign: 'center',
  },
  classCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  cardRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  className: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  classMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  classMetaMuted: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6B7280',
    textAlign: 'center',
  },
  emptySubText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
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
  levelSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  levelSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  levelSelectBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  levelSelectBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  levelSelectBtnTextActive: {
    color: '#FFFFFF',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: 'bold',
  },
  submitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
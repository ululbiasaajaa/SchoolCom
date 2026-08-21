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

import {
  createManagedUser,
  linkParentToStudent,
  subscribeToAllUsers,
  unlinkParentFromStudent,
  updateUserClasses,
  updateUserRole,
} from '../../service/adminService';
import {
  CategoryType,
  Incident,
  StatusType,
  Student,
  User,
} from '../../types/schoolcom';
import { getStatusBadgeStyle } from '../../utils/badges';
import { DateFilterType, matchesDateFilter } from '../../utils/dateParser';
import StudentListView from './StudentListView';

interface AdminDashboardViewProps {
  students: Student[];
  incidents: Incident[];
  metrics: {
    totalObs: number;
    pending: number;
    followUp: number;
    resolved: number;
  };
  onOpenAddStudent?: () => void;
  onSelectStudent?: (studentId: string) => void;
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

export default function AdminDashboardView({
  students,
  incidents,
  metrics,
  onOpenAddStudent,
  onSelectStudent,
}: AdminDashboardViewProps) {
  // Tab Switcher Utama Admin
  const [activeAdminTab, setActiveAdminTab] = useState<
    'Report' | 'StudentList' | 'Users' | 'Teachers'
  >('Report');

  // Existing Report Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | StatusType>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | CategoryType>('All');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterType>('All');

  // Users & Management States
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState<boolean>(true);
  const [userRoleFilter, setUserRoleFilter] = useState<'All' | 'admin' | 'teacher' | 'parent'>('All');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Form Modal States: Create User
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'teacher' | 'parent'>('teacher');
  const [newUserTempPass, setNewUserTempPass] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Modal State: Credential Result Display
  const [createdCredential, setCreatedCredential] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);

  // Edit User & Teacher Classes Modal State
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState<boolean>(false);
  const [editUserClassesInput, setEditUserClassesInput] = useState('');

  // Subscribe Real-time ke Koleksi Users
  useEffect(() => {
    setIsUsersLoading(true);
    const unsubscribe = subscribeToAllUsers((fetchedUsers) => {
      setAllUsers(fetchedUsers);
      setIsUsersLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filtering Users List
  const filteredUsers = useMemo(() => {
    let result = [...allUsers];

    if (userRoleFilter !== 'All') {
      result = result.filter((u) => u.role === userRoleFilter);
    }

    if (userSearchQuery.trim()) {
      const q = userSearchQuery.trim().toLowerCase();
      result = result.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allUsers, userRoleFilter, userSearchQuery]);

  // List Khusus Guru untuk Tab Manajemen Guru
  const teacherUsers = useMemo(() => {
    return allUsers.filter((u) => u.role === 'teacher');
  }, [allUsers]);

  // Handler: Buat User Baru (Secondary App Atomic Execution)
  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      Alert.alert('Form Belum Lengkap', 'Nama dan Email wajib diisi.');
      return;
    }

    setIsSubmittingUser(true);
    try {
      const result = await createManagedUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
        temporaryPassword: newUserTempPass.trim() || undefined,
      });

      setIsCreateUserModalOpen(false);
      setCreatedCredential({
        email: newUserEmail.trim(),
        temporaryPassword: result.temporaryPassword,
      });

      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('teacher');
      setNewUserTempPass('');
    } catch (error: any) {
      console.error('Error creating user:', error);
      Alert.alert(
        'Gagal Membuat Akun',
        error?.message || 'Terjadi kesalahan sistem saat mendaftarkan akun.'
      );
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Handler: Buka Modal Edit User / Guru
  const handleOpenEditUser = (user: User) => {
    setSelectedUserForEdit(user);
    setEditUserClassesInput((user.classes || []).join(', '));
    setIsEditUserModalOpen(true);
  };

  // Handler: Update Role User dengan Dialog Konfirmasi
  const handleUpdateRole = (newRole: 'admin' | 'teacher' | 'parent') => {
    if (!selectedUserForEdit) return;
    if (selectedUserForEdit.role === newRole) return;

    Alert.alert(
      'Konfirmasi Ubah Role',
      `Apakah Anda yakin ingin mengubah role ${selectedUserForEdit.name} dari ${selectedUserForEdit.role.toUpperCase()} menjadi ${newRole.toUpperCase()}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Ubah Role',
          style: newRole === 'admin' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const targetUid = selectedUserForEdit.uid || (selectedUserForEdit as any).id;
              await updateUserRole(targetUid, newRole);
              setSelectedUserForEdit({ ...selectedUserForEdit, role: newRole });
              Alert.alert('Sukses', `Role pengguna berhasil diubah menjadi ${newRole.toUpperCase()}.`);
            } catch (err) {
              Alert.alert('Gagal', 'Terjadi kesalahan saat mengubah role pengguna.');
            }
          },
        },
      ]
    );
  };

  // Handler: Update Kelas Guru
  const handleSaveTeacherClasses = async () => {
    if (!selectedUserForEdit) return;
    try {
      const classesArray = editUserClassesInput
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const targetUid = selectedUserForEdit.uid || (selectedUserForEdit as any).id;
      await updateUserClasses(targetUid, classesArray);
      setIsEditUserModalOpen(false);
      Alert.alert('Sukses', 'Daftar kelas binaan guru berhasil diperbarui.');
    } catch (err) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat memperbarui kelas guru.');
    }
  };

  // Handler: Link / Unlink Student to Parent
  const handleToggleParentStudentLink = async (studentId: string, isLinked: boolean) => {
    if (!selectedUserForEdit) return;
    const parentUid = selectedUserForEdit.uid || (selectedUserForEdit as any).id;

    try {
      if (isLinked) {
        await unlinkParentFromStudent(parentUid, studentId);
        setSelectedUserForEdit({
          ...selectedUserForEdit,
          studentIds: (selectedUserForEdit.studentIds || []).filter((id) => id !== studentId),
        });
      } else {
        await linkParentToStudent(parentUid, studentId);
        setSelectedUserForEdit({
          ...selectedUserForEdit,
          studentIds: [...(selectedUserForEdit.studentIds || []), studentId],
        });
      }
    } catch (err) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat mengaitkan siswa dengan orang tua.');
    }
  };

  // Filter & Sorting Incident untuk Admin
  const filteredIncidents = useMemo(() => {
    let result = [...incidents];

    if (selectedStatus !== 'All') {
      result = result.filter((i: Incident) => {
        const rawStatus = (i.status || '').toString();
        const isValidStatus = ['Pending', 'Follow-up', 'Resolved'].includes(rawStatus);
        const safeStatus = isValidStatus ? rawStatus : 'Pending';
        return safeStatus === selectedStatus;
      });
    }

    if (selectedCategory !== 'All') {
      result = result.filter((i: Incident) => i.category === selectedCategory);
    }

    if (selectedDateFilter !== 'All') {
      result = result.filter((i: Incident) => matchesDateFilter(i.createdAt, selectedDateFilter));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((i: Incident) => {
        const student = students.find((s) => s.id === i.studentId);
        const studentName = student?.name.toLowerCase() || '';
        const teacherName = i.teacherName?.toLowerCase() || '';
        const desc = i.description.toLowerCase();

        return studentName.includes(q) || teacherName.includes(q) || desc.includes(q);
      });
    }

    return result.sort(
      (a: Incident, b: Incident) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [incidents, students, selectedStatus, selectedCategory, selectedDateFilter, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Tab Switcher Admin */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabSwitcherScroll}>
        <View style={styles.tabSwitcherContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeAdminTab === 'Report' && styles.tabBtnActive]}
            onPress={() => setActiveAdminTab('Report')}
          >
            <Text style={[styles.tabBtnText, activeAdminTab === 'Report' && styles.tabBtnTextActive]}>
              📋 Laporan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeAdminTab === 'StudentList' && styles.tabBtnActive]}
            onPress={() => setActiveAdminTab('StudentList')}
          >
            <Text style={[styles.tabBtnText, activeAdminTab === 'StudentList' && styles.tabBtnTextActive]}>
              👨‍🎓 Siswa
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeAdminTab === 'Users' && styles.tabBtnActive]}
            onPress={() => setActiveAdminTab('Users')}
          >
            <Text style={[styles.tabBtnText, activeAdminTab === 'Users' && styles.tabBtnTextActive]}>
              👥 User
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeAdminTab === 'Teachers' && styles.tabBtnActive]}
            onPress={() => setActiveAdminTab('Teachers')}
          >
            <Text style={[styles.tabBtnText, activeAdminTab === 'Teachers' && styles.tabBtnTextActive]}>
              👨‍🏫 Guru
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CONDITIONAL RENDERING TAB CONTENT */}
      {activeAdminTab === 'StudentList' ? (
        <StudentListView students={students} onSelectStudent={onSelectStudent} />
      ) : activeAdminTab === 'Users' ? (
        /* TAB 3: MANAJEMEN USER */
        <View style={styles.tabContentFlex}>
          <View style={styles.actionHeaderRow}>
            <Text style={styles.sectionHeader}>Daftar Pengguna Sistem</Text>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => setIsCreateUserModalOpen(true)}
            >
              <Text style={styles.primaryActionBtnText}>+ Tambah User</Text>
            </TouchableOpacity>
          </View>

          {/* Search User */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Cari nama atau email user..."
              placeholderTextColor="#9CA3AF"
              value={userSearchQuery}
              onChangeText={setUserSearchQuery}
            />
          </View>

          {/* Filter Role Chips */}
          <View style={styles.chipRow}>
            {(['All', 'admin', 'teacher', 'parent'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.filterChip, userRoleFilter === r && styles.filterChipActive]}
                onPress={() => setUserRoleFilter(r)}
              >
                <Text style={[styles.filterChipText, userRoleFilter === r && styles.filterChipTextActive]}>
                  {r === 'All' ? 'Semua Role' : r.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List Users */}
          {isUsersLoading ? (
            <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 24 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 8 }}>
              {filteredUsers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>Tidak ada user ditemukan.</Text>
                </View>
              ) : (
                filteredUsers.map((u, index) => (
                  <View key={u.uid || (u as any).id || `user-${index}`} style={styles.userCard}>
                    <View style={styles.cardRowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userNameText}>{u.name}</Text>
                        <Text style={styles.userEmailText}>{u.email}</Text>
                      </View>
                      <View
                        style={[
                          styles.roleBadge,
                          {
                            backgroundColor:
                              u.role === 'admin'
                                ? '#FEE2E2'
                                : u.role === 'teacher'
                                ? '#DBEAFE'
                                : '#FEF3C7',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleBadgeText,
                            {
                              color:
                                u.role === 'admin'
                                  ? '#DC2626'
                                  : u.role === 'teacher'
                                  ? '#2563EB'
                                  : '#D97706',
                            },
                          ]}
                        >
                          {u.role.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.editUserBtn}
                      onPress={() => handleOpenEditUser(u)}
                    >
                      <Text style={styles.editUserBtnText}>⚙️ Kelola Role & Relasi</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      ) : activeAdminTab === 'Teachers' ? (
        /* TAB 4: MANAJEMEN GURU */
        <View style={styles.tabContentFlex}>
          <Text style={styles.sectionHeader}>Daftar Guru & Kelas Binaan</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 8 }}>
            {teacherUsers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Belum ada data guru terdaftar.</Text>
              </View>
            ) : (
              teacherUsers.map((t, index) => (
                <View key={t.uid || (t as any).id || `teacher-${index}`} style={styles.userCard}>
                  <Text style={styles.userNameText}>👨‍🏫 {t.name}</Text>
                  <Text style={styles.userEmailText}>{t.email}</Text>
                  <View style={styles.classesContainer}>
                    <Text style={styles.classesLabel}>Kelas Binaan: </Text>
                    {t.classes && t.classes.length > 0 ? (
                      t.classes.map((c: string, idx: number) => (
                        <View key={idx} style={styles.classChip}>
                          <Text style={styles.classChipText}>{c}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noClassText}>Belum diatur</Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.editUserBtn} onPress={() => handleOpenEditUser(t)}>
                    <Text style={styles.editUserBtnText}>✏️ Atur Kelas Binaan</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      ) : (
        /* TAB 1: LAPORAN (EXISTING REPORTING DASHBOARD) */
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <View style={styles.adminCard}>
            <Text style={styles.adminTitle}>Dashboard Kepala Sekolah / Admin</Text>
            <Text style={styles.adminSub}>Monitoring Keseluruhan Laporan & Aktivitas Guru</Text>
          </View>

          {/* Ringkasan Metrics */}
          <View style={styles.metricsGrid}>
            <TouchableOpacity
              style={[styles.metricCard, styles.interactiveMetricCard]}
              onPress={onOpenAddStudent}
              activeOpacity={0.7}
            >
              <Text style={[styles.metricVal, { color: '#2563EB' }]}>{students.length}</Text>
              <Text style={styles.metricLbl}>Total Siswa (+)</Text>
            </TouchableOpacity>

            <View style={styles.metricCard}>
              <Text style={styles.metricVal}>{metrics.totalObs}</Text>
              <Text style={styles.metricLbl}>Total Insiden</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.metricVal, { color: '#D97706' }]}>{metrics.pending}</Text>
              <Text style={styles.metricLbl}>Pending</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: '#D1FAE5' }]}>
              <Text style={[styles.metricVal, { color: '#059669' }]}>{metrics.resolved}</Text>
              <Text style={styles.metricLbl}>Resolved</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Semua Laporan Guru (Recent Reports)</Text>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Cari nama siswa, guru, atau catatan..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={() => setSearchQuery('')}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

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

          {/* List / Empty State */}
          {filteredIncidents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>Tidak Ada Laporan Ditemukan</Text>
              <Text style={styles.emptySubText}>
                Tidak ada data yang sesuai dengan pencarian atau filter pilihan Anda.
              </Text>
            </View>
          ) : (
            filteredIncidents.map((item: Incident) => {
              const student = students.find((s) => s.id === item.studentId);
              const rawStatus = (item.status || '').toString();
              const isValidStatus = ['Pending', 'Follow-up', 'Resolved'].includes(rawStatus);
              const safeStatus: StatusType = isValidStatus ? (rawStatus as StatusType) : 'Pending';

              const badge = getStatusBadgeStyle(safeStatus);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => onSelectStudent && onSelectStudent(item.studentId)}
                  activeOpacity={0.7}
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
                  <Text style={styles.cardMeta}>
                    Guru: {item.teacherName || 'Guru'} • {item.createdAt}
                  </Text>
                  <Text style={styles.cardDesc}>{item.description}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* MODAL 1: CREATE NEW USER */}
      <Modal
        visible={isCreateUserModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateUserModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tambah Pengguna Baru</Text>
            <Text style={styles.modalSubtitle}>Mendaftarkan akun ke sistem secara langsung.</Text>

            <Text style={styles.inputLabel}>Nama Lengkap:</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Contoh: Budi Santoso"
              value={newUserName}
              onChangeText={setNewUserName}
            />

            <Text style={styles.inputLabel}>Email:</Text>
            <TextInput
              style={styles.formInput}
              placeholder="budi@school.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={newUserEmail}
              onChangeText={setNewUserEmail}
            />

            <Text style={styles.inputLabel}>Role Pengguna:</Text>
            <View style={styles.roleSelectorRow}>
              {(['teacher', 'parent', 'admin'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleSelectBtn, newUserRole === r && styles.roleSelectBtnActive]}
                  onPress={() => setNewUserRole(r)}
                >
                  <Text
                    style={[
                      styles.roleSelectBtnText,
                      newUserRole === r && styles.roleSelectBtnTextActive,
                    ]}
                  >
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Password Sementara (Kosongkan untuk Password Acak):</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Opsional (misal: Rahasia123!)"
              secureTextEntry={true}
              value={newUserTempPass}
              onChangeText={setNewUserTempPass}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsCreateUserModalOpen(false)}
                disabled={isSubmittingUser}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateUser}
                disabled={isSubmittingUser}
              >
                {isSubmittingUser ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Simpan & Buat Akun</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: CREDENTIAL RESULT DISPLAY */}
      <Modal
        visible={createdCredential !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCreatedCredential(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎉 Akun Berhasil Dibuat!</Text>
            <Text style={styles.modalSubtitle}>
              Berikan informasi kredensial login berikut kepada pengguna:
            </Text>

            <View style={styles.credentialBox}>
              <Text style={styles.credText}>
                Email: <Text style={{ fontWeight: 'bold' }}>{createdCredential?.email}</Text>
              </Text>
              <Text style={styles.credText}>
                Password Sementara:{' '}
                <Text style={{ fontWeight: 'bold', color: '#2563EB' }}>
                  {createdCredential?.temporaryPassword}
                </Text>
              </Text>
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => setCreatedCredential(null)}
            >
              <Text style={styles.submitBtnText}>Selesai & Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: EDIT USER ROLE, CLASSES, & PARENT-STUDENT LINK */}
      <Modal
        visible={isEditUserModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditUserModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Kelola Pengguna</Text>
            {selectedUserForEdit && (
              <Text style={styles.modalSubtitle}>{selectedUserForEdit.name}</Text>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              <Text style={styles.inputLabel}>Ubah Role Pengguna:</Text>
              <View style={styles.roleSelectorRow}>
                {(['admin', 'teacher', 'parent'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleSelectBtn,
                      selectedUserForEdit?.role === r && styles.roleSelectBtnActive,
                    ]}
                    onPress={() => handleUpdateRole(r)}
                  >
                    <Text
                      style={[
                        styles.roleSelectBtnText,
                        selectedUserForEdit?.role === r && styles.roleSelectBtnTextActive,
                      ]}
                    >
                      {r.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* SECTION KHUSUS GURU: KELAS BINAAN */}
              {selectedUserForEdit?.role === 'teacher' && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.inputLabel}>Kelas Binaan (Pisahkan dengan koma):</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Contoh: Kelas TK-A, Kelas TK-B"
                    value={editUserClassesInput}
                    onChangeText={setEditUserClassesInput}
                  />
                  <TouchableOpacity
                    style={styles.saveSectionBtn}
                    onPress={handleSaveTeacherClasses}
                  >
                    <Text style={styles.saveSectionBtnText}>Simpan Kelas Binaan</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* SECTION KHUSUS PARENT: PARENT-STUDENT LINK */}
              {selectedUserForEdit?.role === 'parent' && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.inputLabel}>Tautkan Anak (Siswa):</Text>
                  {students.map((s) => {
                    const isLinked = (selectedUserForEdit.studentIds || []).includes(s.id);
                    return (
                      <View key={s.id} style={styles.linkStudentRow}>
                        <Text style={styles.linkStudentName}>
                          {s.avatar || '👦'} {s.name} ({s.className})
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.linkBtn,
                            isLinked ? styles.linkBtnActive : styles.linkBtnInactive,
                          ]}
                          onPress={() => handleToggleParentStudentLink(s.id, isLinked)}
                        >
                          <Text style={styles.linkBtnText}>
                            {isLinked ? 'Ditautkan ✓' : '+ Tautkan'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 16 }]}
              onPress={() => setIsEditUserModalOpen(false)}
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
  container: {
    flex: 1,
  },
  tabSwitcherScroll: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    maxHeight: 52,
  },
  tabSwitcherContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
    padding: 16,
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
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  userNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  userEmailText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  editUserBtn: {
    marginTop: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editUserBtnText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
  classesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  classesLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  classChip: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
  },
  classChipText: {
    fontSize: 10,
    color: '#3730A3',
    fontWeight: 'bold',
  },
  noClassText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  adminCard: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  adminTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  adminSub: {
    color: '#BFDBFE',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  interactiveMetricCard: {
    borderColor: '#93C5FD',
    borderWidth: 1.5,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 12,
    color: '#111827',
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  filterScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginRight: 6,
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
    fontSize: 11,
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 6,
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
    marginTop: 2,
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
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
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
  roleSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  roleSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  roleSelectBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  roleSelectBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  roleSelectBtnTextActive: {
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
  credentialBox: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginVertical: 12,
  },
  credText: {
    fontSize: 13,
    color: '#1F2937',
    marginBottom: 4,
  },
  saveSectionBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  saveSectionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  linkStudentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  linkStudentName: {
    fontSize: 12,
    color: '#1F2937',
    flex: 1,
  },
  linkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  linkBtnActive: {
    backgroundColor: '#D1FAE5',
  },
  linkBtnInactive: {
    backgroundColor: '#F3F4F6',
  },
  linkBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#059669',
  },
});
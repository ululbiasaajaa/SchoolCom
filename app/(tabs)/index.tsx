import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Import Types
import {
  CategoryType,
  Incident,
  PriorityType,
  StatusType,
  Student,
  User,
  UserRole,
} from '../../types/schoolcom';

// Import Modular Components & Views
import AddStudentModal from '../../components/modals/AddStudentModal';
import AdminAssessmentConfigModal from '../../components/modals/AdminAssessmentConfigModal';
import EditStudentModal from '../../components/modals/EditStudentModal';
import FollowUpModal from '../../components/modals/FollowUpModal';
import NewIncidentModal from '../../components/modals/NewIncidentModal';
import WhatsAppModal from '../../components/modals/WhatsAppModal';
import AdminDashboardView from '../../components/views/AdminDashboardView';
import ParentDashboardView from '../../components/views/ParentDashboardView';
import StudentListView from '../../components/views/StudentListView';
import StudentProfileView from '../../components/views/StudentProfileView';
import TeacherAssessmentView from '../../components/views/TeacherAssessmentView';
import TeacherAttendanceView from '../../components/views/TeacherAttendanceView';
import TeacherDashboardView from '../../components/views/TeacherDashboardView';

// Import Firebase Services
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { logoutUser } from '../../service/authService';
import {
  addFollowUpLog,
  addIncident,
  subscribeToRecentIncidents,
  updateIncidentStatus,
} from '../../service/incidentService';
import { subscribeToStudents } from '../../service/studentService';

// Import Notification Services (Sub-Phase 17.4)
import { notifyParentOnIncident } from '../../service/pushNotificationService';
import {
  registerForPushNotificationsAsync,
  unregisterPushTokenAsync,
} from '../../service/pushTokenService';

// Helper sanitasi status internal
const getSafeStatus = (raw: string | undefined): StatusType => {
  const s = (raw || '').toString();
  return ['Pending', 'Follow-up', 'Resolved'].includes(s) ? (s as StatusType) : 'Pending';
};

export default function HomeScreen() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>('Pengguna');
  
  // 18.2-A: FAIL-CLOSED ROLE STATE (Default NULL, Tanpa Fallback Privilege)
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Tab State untuk role Teacher & Admin
  const [currentTab, setCurrentTab] = useState<
    'Dashboard' | 'Students' | 'Attendance' | 'Assessment' | 'AdminDash' | 'ParentDash'
  >('Dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const [isNewIncidentModalOpen, setIsNewIncidentModalOpen] = useState<boolean>(false);
  const [targetStudentForNewIncident, setTargetStudentForNewIncident] = useState<string>('');

  const [isWaModalOpen, setIsWaModalOpen] = useState<boolean>(false);
  const [selectedStudentForWa, setSelectedStudentForWa] = useState<Student | null>(null);
  const [selectedIncidentForWa, setSelectedIncidentForWa] = useState<Incident | null>(null);

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState<boolean>(false);
  const [selectedIncidentForAction, setSelectedIncidentForAction] = useState<Incident | null>(null);

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState<boolean>(false);
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState<boolean>(false);
  const [studentForEdit, setStudentForEdit] = useState<Student | null>(null);

  // Modal Assessment Config (Admin Only)
  const [isAssessmentConfigModalOpen, setIsAssessmentConfigModalOpen] = useState<boolean>(false);

  // 18.2-B & 18.2-C: PROFILE READINESS & FAIL-CLOSED HANDLER
  const fetchUserProfile = async () => {
    setIsLoadingProfile(true);
    setProfileError(null);

    const fbUser = auth.currentUser;
    if (!fbUser) {
      setIsLoadingProfile(false);
      return;
    }

    try {
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        const rawRole = (data.role?.toLowerCase() as string) || '';
        
        // Validation check valid role
        if (!['admin', 'teacher', 'parent'].includes(rawRole)) {
          console.error('[Security Guard] Invalid role detected in Firestore:', rawRole);
          Alert.alert('Akses Ditolak', 'Peran pengguna tidak valid. Silakan hubungi Administrator.');
          await logoutUser();
          return;
        }

        const fetchedRole = rawRole as UserRole;
        const activeUser: User = {
          uid: fbUser.uid,
          name: data.name || fbUser.displayName || 'Pengguna',
          email: data.email || fbUser.email || '',
          role: fetchedRole,
          studentIds: data.studentIds || [],
          classes: data.classes || [],
        };

        setCurrentUser(activeUser);
        setUserName(activeUser.name);
        setUserRole(activeUser.role);

        if (activeUser.role === 'admin') {
          setCurrentTab('AdminDash');
        } else if (activeUser.role === 'parent') {
          setCurrentTab('ParentDash');
        } else {
          setCurrentTab('Dashboard');
        }
      } else {
        // CASE 1: PROFILE_NOT_FOUND -> FAIL CLOSED & LOGOUT
        console.error('[Security Guard] Profile document missing for UID:', fbUser.uid);
        Alert.alert(
          'Akun Tidak Ditemukan',
          'Dokumen profil Anda tidak ditemukan di sistem. Sesi Anda akan diakhiri.',
          [{ text: 'OK', onPress: () => logoutUser() }]
        );
      }
    } catch (error: any) {
      console.error('Error fetching user profile in HomeScreen:', error);
      
      // CASE 2: PERMISSION DENIED -> FAIL CLOSED & LOGOUT
      if (error?.code === 'permission-denied') {
        Alert.alert(
          'Akses Ditolak',
          'Anda tidak memiliki izin membaca data profil. Sesi akan diakhiri.',
          [{ text: 'OK', onPress: () => logoutUser() }]
        );
      } else {
        // CASE 3: TRANSIENT LOAD ERROR -> NO LOGOUT, SHOW RETRY STATE
        setProfileError('Gagal memuat profil akibat gangguan jaringan. Silakan coba lagi.');
      }
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // 18.2-E: SIDE EFFECT PROTECTION FOR PUSH NOTIFICATION REGISTRATION
  useEffect(() => {
    if (isLoadingProfile || !currentUser || !userRole) return;

    registerForPushNotificationsAsync(currentUser).catch((err) => {
      console.warn('Gagal melakukan pendaftaran Push Token otomatis:', err);
    });
  }, [currentUser, isLoadingProfile, userRole]);

  // 18.2-E: SIDE EFFECT PROTECTION FOR SUBSCRIPTIONS
  useEffect(() => {
    // Guard: Mencegah subscription aktif sebelum profile & role benar-benar siap
    if (isLoadingProfile || !currentUser || !userRole) return;

    // Role Parent tidak membaca seluruh daftar siswa/incidents
    if (userRole === 'parent') {
      return;
    }

    const unsubStudents = subscribeToStudents((data) => {
      setStudents(data);
    });

    const unsubIncidents = subscribeToRecentIncidents((data) => {
      setIncidents(data);
    });

    return () => {
      unsubStudents();
      unsubIncidents();
    };
  }, [userRole, currentUser, isLoadingProfile]);

  // SCOPING SISWA KHUSUS GURU: Strict Isolation (Kosong jika belum punya kelas binaan)
  const teacherStudents = useMemo(() => {
    if (userRole !== 'teacher') return students;
    if (!currentUser?.classes || currentUser.classes.length === 0) {
      return []; // Mencegah kebocoran data siswa ke guru tanpa kelas binaan
    }
    return students.filter((s) => currentUser.classes?.includes(s.className));
  }, [students, currentUser, userRole]);

  // SCOPING INCIDENTS KHUSUS GURU: Strict Isolation (Ikut kosong jika teacherStudents kosong)
  const teacherIncidents = useMemo(() => {
    if (userRole !== 'teacher') return incidents;
    if (!currentUser?.classes || currentUser.classes.length === 0) {
      return []; // Mencegah kebocoran catatan ke guru tanpa kelas binaan
    }
    const teacherStudentIds = new Set(teacherStudents.map((s) => s.id));
    return incidents.filter((i) => teacherStudentIds.has(i.studentId));
  }, [incidents, teacherStudents, currentUser, userRole]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  const studentIncidents = useMemo(() => {
    if (!selectedStudentId) return [];
    return incidents.filter((inc) => inc.studentId === selectedStudentId);
  }, [incidents, selectedStudentId]);

  const metrics = useMemo(() => {
    const targetIncidents = userRole === 'teacher' ? teacherIncidents : incidents;
    return {
      totalObs: targetIncidents.length,
      pending: targetIncidents.filter((i) => getSafeStatus(i.status) === 'Pending').length,
      followUp: targetIncidents.filter((i) => getSafeStatus(i.status) === 'Follow-up').length,
      resolved: targetIncidents.filter((i) => getSafeStatus(i.status) === 'Resolved').length,
    };
  }, [incidents, teacherIncidents, userRole]);

  const handleOpenNewIncident = (studentId = '') => {
    setTargetStudentForNewIncident(studentId);
    setIsNewIncidentModalOpen(true);
  };

  const handleOpenEditStudentModal = (student: Student) => {
    setStudentForEdit(student);
    setIsEditStudentModalOpen(true);
  };

  const handleSaveIncident = async (data: {
    studentId: string;
    category: CategoryType;
    priority: PriorityType;
    description: string;
    actionTaken: string;
  }) => {
    const targetStudent = students.find((s) => s.id === data.studentId);
    if (!targetStudent) {
      Alert.alert('Gagal', 'Siswa tidak ditemukan.');
      return;
    }

    try {
      await addIncident({
        studentId: data.studentId,
        studentName: targetStudent.name,
        className: targetStudent.className,
        category: data.category,
        priority: data.priority,
        description: data.description,
        actionTaken: data.actionTaken,
        status: 'Pending',
        teacherName: userName,
      });

      // TRIGGER PUSH NOTIFICATION EVT-01 (FIRE-AND-FORGET HASIL NYATA SUB-PHASE 17.4)
      notifyParentOnIncident(
        data.studentId,
        targetStudent.name,
        data.category,
        'Catatan Perilaku Baru'
      ).catch((err) => console.warn('Gagal memicu push notifikasi insiden:', err));

      setIsNewIncidentModalOpen(false);
      Alert.alert('Sukses', 'Catatan baru berhasil disimpan ke database!');
    } catch (error) {
      console.error('Error saving incident in HomeScreen:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan catatan ke database.');
    }
  };

  const handleOpenWaModal = (student: Student, incident: Incident | null = null) => {
    if (!student || !student.parents || student.parents.length === 0) {
      Alert.alert('Kontak Tidak Ada', 'Siswa ini belum memiliki data orang tua/wali.');
      return;
    }

    setSelectedStudentForWa(student);
    setSelectedIncidentForWa(incident);
    setIsWaModalOpen(true);
  };

  const handleOpenFollowUpModal = (incident: Incident) => {
    setSelectedIncidentForAction(incident);
    setIsFollowUpModalOpen(true);
  };

  const handleSaveFollowUp = async (
    incidentId: string,
    updatedStatus: StatusType,
    updateNote: string
  ) => {
    const targetIncident = selectedIncidentForAction || incidents.find((i) => i.id === incidentId);
    if (!targetIncident) return;

    try {
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const uniqueLogId = `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      if (updateNote && updateNote.trim().length > 0) {
        // Menggunakan addFollowUpLog untuk atomic update via arrayUnion
        await addFollowUpLog(
          targetIncident.id,
          {
            id: uniqueLogId,
            note: updateNote.trim(),
            author: userName,
            updatedAt: formattedDate,
          },
          updatedStatus
        );
      } else {
        // Jika hanya mengubah status tanpa menambah note
        await updateIncidentStatus(targetIncident.id, updatedStatus);
      }

      // TRIGGER PUSH NOTIFICATION EVT-02 (UPDATE FOLLOW-UP TO PARENT)
      notifyParentOnIncident(
        targetIncident.studentId,
        targetIncident.studentName || 'Siswa',
        targetIncident.category,
        'Tindak Lanjut Catatan Perilaku'
      ).catch((err) => console.warn('Gagal memicu push notifikasi follow-up:', err));

      setIsFollowUpModalOpen(false);
      Alert.alert('Berhasil', 'Status dan tindak lanjut berhasil diperbarui di database.');
    } catch (error) {
      console.error('Error updating follow-up in HomeScreen:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat memperbarui tindak lanjut di database.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Konfirmasi Logout', 'Apakah Anda yakin ingin keluar dari aplikasi?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          try {
            // UNREGISTER PUSH TOKEN SEBELUM LOGOUT UNTUK PEMBERSIHAN (SUB-PHASE 17.4)
            if (currentUser?.uid) {
              await unregisterPushTokenAsync(currentUser.uid);
            }
            await logoutUser();
          } catch (err) {
            Alert.alert('Error', 'Gagal keluar dari aplikasi.');
          }
        },
      },
    ]);
  };

  // 18.2-D: LOADING SPINNER STATE
  if (isLoadingProfile) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Memuat profil pengguna...</Text>
      </SafeAreaView>
    );
  }

  // 18.2-C: TRANSIENT NETWORK ERROR / RETRY STATE (FAIL CLOSED VIEW)
  if (profileError) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent, { padding: 24 }]}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginBottom: 8 }}>
          Gagal Memuat Profil
        </Text>
        <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>
          {profileError}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
          onPress={fetchUserProfile}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>Coba Lagi</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // 18.2-B: FAIL-CLOSED GUARD (Cegah render dashboard jika userRole/currentUser null)
  if (!currentUser || !userRole) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#DC2626" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header dengan Nama User, Tombol Assessment (Admin), & Tombol Keluar */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.appTitle}>SchoolCom</Text>
          <Text style={styles.userSubTitle}>
            {userName} ({userRole === 'admin' ? 'Admin' : userRole === 'parent' ? 'Orang Tua' : 'Guru'})
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {userRole === 'admin' && (
            <TouchableOpacity
              style={styles.configBtn}
              onPress={() => setIsAssessmentConfigModalOpen(true)}
            >
              <Text style={styles.configBtnText}>⚙️ Assessment</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main View Area (18.2-F: Strictly Exclusive Role-Based Hybrid View) */}
      <View style={{ flex: 1 }}>
        {selectedStudent ? (
          <StudentProfileView
            student={selectedStudent}
            studentIncidents={studentIncidents}
            userRole={userRole === 'admin' ? 'admin' : 'teacher'}
            onBack={() => setSelectedStudentId(null)}
            onOpenWaModal={handleOpenWaModal}
            onOpenNewIncident={handleOpenNewIncident}
            onOpenFollowUpModal={handleOpenFollowUpModal}
            onOpenEditStudent={() => handleOpenEditStudentModal(selectedStudent)}
          />
        ) : userRole === 'parent' ? (
          <ParentDashboardView currentUser={currentUser} students={students} />
        ) : userRole === 'admin' ? (
          <AdminDashboardView
            students={students}
            incidents={incidents}
            metrics={metrics}
            onOpenAddStudent={() => setIsAddStudentModalOpen(true)}
            onSelectStudent={(studentId) => setSelectedStudentId(studentId)}
          />
        ) : currentTab === 'Dashboard' ? (
          <TeacherDashboardView
            teacherName={userName}
            teacherClasses={currentUser?.classes || []}
            metrics={metrics}
            incidents={teacherIncidents}
            students={teacherStudents}
            onOpenNewIncident={() => handleOpenNewIncident()}
            onSelectStudent={(studentId) => {
              setSelectedStudentId(studentId);
              setCurrentTab('Students');
            }}
          />
        ) : currentTab === 'Attendance' ? (
          <TeacherAttendanceView
            students={teacherStudents}
            teacherClasses={currentUser?.classes || []}
            teacherName={userName}
          />
        ) : currentTab === 'Assessment' ? (
          <TeacherAssessmentView
            students={teacherStudents}
            teacherName={userName}
          />
        ) : (
          <StudentListView
            students={teacherStudents}
            onSelectStudent={(studentId) => setSelectedStudentId(studentId)}
          />
        )}
      </View>

      {/* Bottom Nav khusus Role Guru */}
      {userRole === 'teacher' && !selectedStudent && (
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navTab}
            onPress={() => {
              setSelectedStudentId(null);
              setCurrentTab('Dashboard');
            }}
          >
            <Text style={[styles.navIcon, currentTab === 'Dashboard' && styles.navActive]}>🏠</Text>
            <Text style={[styles.navLabel, currentTab === 'Dashboard' && styles.navActive]}>
              Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => {
              setSelectedStudentId(null);
              setCurrentTab('Attendance');
            }}
          >
            <Text style={[styles.navIcon, currentTab === 'Attendance' && styles.navActive]}>📅</Text>
            <Text style={[styles.navLabel, currentTab === 'Attendance' && styles.navActive]}>
              Absensi
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => {
              setSelectedStudentId(null);
              setCurrentTab('Assessment');
            }}
          >
            <Text style={[styles.navIcon, currentTab === 'Assessment' && styles.navActive]}>📝</Text>
            <Text style={[styles.navLabel, currentTab === 'Assessment' && styles.navActive]}>
              Penilaian
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => {
              setSelectedStudentId(null);
              setCurrentTab('Students');
            }}
          >
            <Text style={[styles.navIcon, currentTab === 'Students' && styles.navActive]}>👶</Text>
            <Text style={[styles.navLabel, currentTab === 'Students' && styles.navActive]}>
              Siswa
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL NEW INCIDENT */}
      <NewIncidentModal
        visible={isNewIncidentModalOpen}
        students={teacherStudents}
        initialStudentId={targetStudentForNewIncident}
        onClose={() => setIsNewIncidentModalOpen(false)}
        onSave={handleSaveIncident}
      />

      {/* MODAL WHATSAPP */}
      <WhatsAppModal
        visible={isWaModalOpen}
        student={selectedStudentForWa}
        incident={selectedIncidentForWa}
        onClose={() => setIsWaModalOpen(false)}
      />

      {/* MODAL FOLLOW-UP */}
      <FollowUpModal
        visible={isFollowUpModalOpen}
        incident={selectedIncidentForAction}
        onClose={() => setIsFollowUpModalOpen(false)}
        onSave={handleSaveFollowUp}
      />

      {/* MODAL ADD STUDENT (ADMIN ONLY) */}
      <AddStudentModal
        visible={isAddStudentModalOpen}
        onClose={() => setIsAddStudentModalOpen(false)}
      />

      {/* MODAL EDIT & DELETE STUDENT (ADMIN ONLY) */}
      <EditStudentModal
        visible={isEditStudentModalOpen}
        student={studentForEdit}
        onClose={() => {
          setIsEditStudentModalOpen(false);
          setStudentForEdit(null);
        }}
      />

      {/* MODAL CONFIG ASSESSMENT (ADMIN ONLY) */}
      <AdminAssessmentConfigModal
        visible={isAssessmentConfigModalOpen}
        onClose={() => setIsAssessmentConfigModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
  },
  userSubTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 1,
  },
  configBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  configBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  bottomNav: {
    flexDirection: 'row',
    height: Platform.OS === 'android' ? 84 : 70,
    paddingBottom: Platform.OS === 'android' ? 28 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  navTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 18,
    opacity: 0.5,
  },
  navLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  navActive: {
    opacity: 1,
    color: '#2563EB',
    fontWeight: '700',
  },
});
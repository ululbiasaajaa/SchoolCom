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
} from '../../types/schoolcom';

// Import Modular Components & Views
import FollowUpModal from '../../components/modals/FollowUpModal';
import NewIncidentModal from '../../components/modals/NewIncidentModal';
import WhatsAppModal from '../../components/modals/WhatsAppModal';
import AdminDashboardView from '../../components/views/AdminDashboardView';
import StudentListView from '../../components/views/StudentListView';
import StudentProfileView from '../../components/views/StudentProfileView';
import TeacherDashboardView from '../../components/views/TeacherDashboardView';

// Import Firebase Services
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { logoutUser } from '../../service/authService';
import {
  addIncident,
  subscribeToRecentIncidents,
  updateIncident,
} from '../../service/incidentService';
import { subscribeToStudents } from '../../service/studentService';

// Helper sanitasi status internal
const getSafeStatus = (raw: string | undefined): StatusType => {
  const s = (raw || '').toString();
  return ['Pending', 'Follow-up', 'Resolved'].includes(s) ? (s as StatusType) : 'Pending';
};

export default function HomeScreen() {
  // Real User State from Firebase Auth & Firestore
  const [userName, setUserName] = useState<string>('Guru');
  const [userRole, setUserRole] = useState<'teacher' | 'admin'>('teacher');
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);

  const [currentTab, setCurrentTab] = useState<'Dashboard' | 'Students' | 'AdminDash'>('Dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // States populated exclusively by Firestore Realtime Listeners
  const [students, setStudents] = useState<Student[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Modals Visibility & Selection State
  const [isNewIncidentModalOpen, setIsNewIncidentModalOpen] = useState<boolean>(false);
  const [targetStudentForNewIncident, setTargetStudentForNewIncident] = useState<string>('');
  
  const [isWaModalOpen, setIsWaModalOpen] = useState<boolean>(false);
  const [selectedStudentForWa, setSelectedStudentForWa] = useState<Student | null>(null);
  const [selectedIncidentForWa, setSelectedIncidentForWa] = useState<Incident | null>(null);

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState<boolean>(false);
  const [selectedIncidentForAction, setSelectedIncidentForAction] = useState<Incident | null>(null);

  // 1. Fetch Real User Profile from Firestore 'users' Collection
  useEffect(() => {
    const fetchUserProfile = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            if (data.name) setUserName(data.name);
            if (data.role) {
              const roleLower = data.role.toLowerCase();
              if (roleLower === 'admin') {
                setUserRole('admin');
                setCurrentTab('AdminDash');
              } else {
                setUserRole('teacher');
                setCurrentTab('Dashboard');
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user profile in HomeScreen:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      } else {
        setIsLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, []);

  // 2. Subscribe to Realtime Students & Incidents from Firestore
  useEffect(() => {
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
  }, []);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  const studentIncidents = useMemo(() => {
    if (!selectedStudentId) return [];
    return incidents.filter((inc) => inc.studentId === selectedStudentId);
  }, [incidents, selectedStudentId]);

  const metrics = useMemo(() => {
    return {
      totalObs: incidents.length,
      pending: incidents.filter((i) => getSafeStatus(i.status) === 'Pending').length,
      followUp: incidents.filter((i) => getSafeStatus(i.status) === 'Follow-up').length,
      resolved: incidents.filter((i) => getSafeStatus(i.status) === 'Resolved').length,
    };
  }, [incidents]);

  const handleOpenNewIncident = (studentId = '') => {
    setTargetStudentForNewIncident(studentId);
    setIsNewIncidentModalOpen(true);
  };

  // CREATE Incident Baru ke Cloud Firestore
  const handleSaveIncident = async (data: {
    studentId: string;
    category: CategoryType;
    priority: PriorityType;
    description: string;
    actionTaken: string;
  }) => {
    try {
      await addIncident({
        studentId: data.studentId,
        category: data.category,
        priority: data.priority,
        description: data.description,
        actionTaken: data.actionTaken,
        status: 'Pending',
        teacherName: userName,
        followUpLogs: [],
      });

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

  // UPDATE Status / Follow-Up Log ke Cloud Firestore (Fix Signatur Parameter 3 Argumen)
  const handleSaveFollowUp = async (incidentId: string, updatedStatus: StatusType, updateNote: string) => {
    const targetIncident = selectedIncidentForAction || incidents.find((i) => i.id === incidentId);
    if (!targetIncident) return;

    try {
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const uniqueLogId = `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const newLogs = [...(targetIncident.followUpLogs || [])];
      
      // Hanya push log jika catatan tidak kosong
      if (updateNote && updateNote.trim().length > 0) {
        newLogs.push({
          id: uniqueLogId,
          note: updateNote.trim(),
          author: userName || 'Guru',
          date: formattedDate,
          updatedAt: formattedDate,
        });
      }

      await updateIncident(targetIncident.id, {
        status: updatedStatus,
        followUpLogs: newLogs,
      });

      setIsFollowUpModalOpen(false);
      Alert.alert('Berhasil', 'Status dan tindak lanjut berhasil diperbarui di database.');
    } catch (error) {
      console.error('Error updating follow-up in HomeScreen:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat memperbarui tindak lanjut di database.');
    }
  };

  // Handler Logout
  const handleLogout = () => {
    Alert.alert(
      'Konfirmasi Logout',
      'Apakah Anda yakin ingin keluar dari aplikasi?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Keluar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
            } catch (err) {
              Alert.alert('Error', 'Gagal keluar dari aplikasi.');
            }
          }
        },
      ]
    );
  };

  if (isLoadingProfile) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header dengan Nama User & Tombol Keluar */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.appTitle}>SchoolCom</Text>
          <Text style={styles.userSubTitle}>
            {userName} ({userRole === 'admin' ? 'Admin' : 'Guru'})
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      {/* Main View Area */}
      <View style={{ flex: 1 }}>
        {userRole === 'teacher' ? (
          selectedStudent ? (
            <StudentProfileView
              student={selectedStudent}
              studentIncidents={studentIncidents}
              onBack={() => setSelectedStudentId(null)}
              onOpenWaModal={handleOpenWaModal}
              onOpenNewIncident={handleOpenNewIncident}
              onOpenFollowUpModal={handleOpenFollowUpModal}
            />
          ) : currentTab === 'Dashboard' ? (
            <TeacherDashboardView
              teacherName={userName}
              metrics={metrics}
              incidents={incidents}
              students={students}
              onOpenNewIncident={() => handleOpenNewIncident()}
              onSelectStudent={(studentId) => {
                setSelectedStudentId(studentId);
                setCurrentTab('Students');
              }}
            />
          ) : (
            <StudentListView
              students={students}
              onSelectStudent={(studentId) => setSelectedStudentId(studentId)}
            />
          )
        ) : (
          <AdminDashboardView
            students={students}
            incidents={incidents}
            metrics={metrics}
          />
        )}
      </View>

      {/* Bottom Nav khusus Role Guru */}
      {userRole === 'teacher' && (
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navTab}
            onPress={() => {
              setSelectedStudentId(null);
              setCurrentTab('Dashboard');
            }}
          >
            <Text style={[styles.navIcon, currentTab === 'Dashboard' && !selectedStudentId && styles.navActive]}>🏠</Text>
            <Text style={[styles.navLabel, currentTab === 'Dashboard' && !selectedStudentId && styles.navActive]}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => {
              setSelectedStudentId(null);
              setCurrentTab('Students');
            }}
          >
            <Text style={[styles.navIcon, (currentTab === 'Students' || selectedStudentId) && styles.navActive]}>👶</Text>
            <Text style={[styles.navLabel, (currentTab === 'Students' || selectedStudentId) && styles.navActive]}>Siswa</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL NEW INCIDENT */}
      <NewIncidentModal
        visible={isNewIncidentModalOpen}
        students={students}
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
    justify: 'center',
    alignItems: 'center',
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
import React, { useEffect, useMemo, useState } from 'react';
import {
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

// Import Firestore Services
import {
  addIncident,
  subscribeToRecentIncidents,
  updateIncident,
} from '../../service/incidentService';
import { subscribeToStudents } from '../../service/studentService';

export default function HomeScreen() {
  const [currentRole, setCurrentRole] = useState<'Teacher' | 'Admin'>('Teacher');
  const [currentTab, setCurrentTab] = useState<'Dashboard' | 'Students' | 'AdminDash'>('Dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // States populated by Firestore Realtime Listeners
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

  // Subscribe to Realtime Students & Incidents from Firestore
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
      pending: incidents.filter((i) => i.status === 'Pending').length,
      followUp: incidents.filter((i) => i.status === 'Follow-up').length,
      resolved: incidents.filter((i) => i.status === 'Resolved').length,
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
        teacherName: 'Bu Guru Ana',
        followUpLogs: [],
      });

      setIsNewIncidentModalOpen(false);
      Alert.alert('Sukses', 'Catatan baru berhasil disimpan ke database!');
    } catch (error) {
      console.error('Error saving incident:', error);
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

  // UPDATE Status / Follow-Up Log ke Cloud Firestore
  const handleSaveFollowUp = async (updatedStatus: StatusType, updateNote: string) => {
    if (!selectedIncidentForAction) return;

    try {
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const newLogs = [...selectedIncidentForAction.followUpLogs];
      if (updateNote.trim()) {
        newLogs.push({
          id: `f-${Date.now()}`,
          note: updateNote.trim(),
          updatedAt: formattedDate,
        });
      }

      await updateIncident(selectedIncidentForAction.id, {
        status: updatedStatus,
        followUpLogs: newLogs,
      });

      setIsFollowUpModalOpen(false);
      Alert.alert('Berhasil', 'Status dan tindak lanjut berhasil diperbarui di database.');
    } catch (error) {
      console.error('Error updating follow-up:', error);
      Alert.alert('Gagal', 'Terjadi kesalahan saat memperbarui tindak lanjut di database.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header & Role Switcher */}
      <View style={styles.topHeader}>
        <Text style={styles.appTitle}>SchoolCom MVP</Text>
        <View style={styles.roleToggle}>
          <TouchableOpacity
            style={[styles.roleBtn, currentRole === 'Teacher' && styles.roleBtnActive]}
            onPress={() => {
              setCurrentRole('Teacher');
              setCurrentTab('Dashboard');
            }}
          >
            <Text style={[styles.roleBtnText, currentRole === 'Teacher' && styles.roleBtnTextActive]}>Guru</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, currentRole === 'Admin' && styles.roleBtnActive]}
            onPress={() => {
              setCurrentRole('Admin');
              setCurrentTab('AdminDash');
            }}
          >
            <Text style={[styles.roleBtnText, currentRole === 'Admin' && styles.roleBtnTextActive]}>Admin</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main View Area */}
      <View style={{ flex: 1 }}>
        {currentRole === 'Teacher' ? (
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

      {/* Bottom Nav untuk Role Guru */}
      {currentRole === 'Teacher' && (
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
    color: '#111827',
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  roleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  roleBtnActive: {
    backgroundColor: '#2563EB',
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  roleBtnTextActive: {
    color: '#FFFFFF',
  },
  bottomNav: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
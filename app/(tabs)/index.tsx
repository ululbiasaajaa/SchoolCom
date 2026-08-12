import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
import StudentProfileView from '../../components/views/StudentProfileView';
import TeacherDashboardView from '../../components/views/TeacherDashboardView';

// ==========================================
// DUMMY DATA BASELINE
// ==========================================
const INITIAL_STUDENTS: Student[] = [
  {
    id: 's1',
    name: 'Ananda Rayyan',
    avatar: '👦',
    className: 'TK-A Bintang',
    dob: '2020-04-12',
    parents: [
      { name: 'Budi Santoso', relationship: 'Ayah', phone: '6281234567890' },
      { name: 'Siti Rahma', relationship: 'Ibu', phone: '6281298765432' },
    ],
  },
  {
    id: 's2',
    name: 'Aisyah Humaira',
    avatar: '👧',
    className: 'TK-A Bintang',
    dob: '2020-08-25',
    parents: [
      { name: 'Ahmad Fauzi', relationship: 'Ayah', phone: '6281311223344' },
    ],
  },
  {
    id: 's3',
    name: 'Kenzo Alfarizqi',
    avatar: '👦',
    className: 'TK-B Bulan',
    dob: '2019-11-05',
    parents: [
      { name: 'Dewi Lestari', relationship: 'Ibu', phone: '6281555667788' },
    ],
  },
];

const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-1',
    studentId: 's1',
    category: 'Behavior',
    priority: 'Medium',
    description: 'Menangis dan tidak mau berbagi mainan balok dengan teman.',
    actionTaken: 'Menenangkan Rayyan dan mengajak bermain bersama Kenzo.',
    status: 'Follow-up',
    createdAt: '2026-08-10 09:15',
    teacherName: 'Bu Guru Ana',
    followUpLogs: [
      {
        id: 'f1',
        note: 'Orang tua disarankan membawa mainan favorit dari rumah untuk transisi.',
        updatedAt: '2026-08-10 14:00',
      },
    ],
  },
  {
    id: 'inc-2',
    studentId: 's2',
    category: 'Academic',
    priority: 'Low',
    description: 'Sangat lancar mengenalkan huruf vokal A-I-U-E-O hari ini.',
    actionTaken: 'Memberikan stiker pujian dan apresiasi di depan kelas.',
    status: 'Resolved',
    createdAt: '2026-08-11 10:30',
    teacherName: 'Bu Guru Ana',
    followUpLogs: [],
  },
  {
    id: 'inc-3',
    studentId: 's3',
    category: 'Incident',
    priority: 'High',
    description: 'Tersandung saat lari di halaman, lutut kanan sedikit lecet.',
    actionTaken: 'Diobati dengan antiseptik dan diplester di ruang UKS.',
    status: 'Pending',
    createdAt: '2026-08-12 08:45',
    teacherName: 'Bu Guru Ana',
    followUpLogs: [],
  },
];

// ==========================================
// MAIN SCREEN COMPONENT
// ==========================================
export default function HomeScreen() {
  const [currentRole, setCurrentRole] = useState<'Teacher' | 'Admin'>('Teacher');
  const [currentTab, setCurrentTab] = useState<'Dashboard' | 'Students' | 'AdminDash'>('Dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [students] = useState<Student[]>(INITIAL_STUDENTS);
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals Visibility & Selection State
  const [isNewIncidentModalOpen, setIsNewIncidentModalOpen] = useState<boolean>(false);
  const [targetStudentForNewIncident, setTargetStudentForNewIncident] = useState<string>('');
  
  const [isWaModalOpen, setIsWaModalOpen] = useState<boolean>(false);
  const [selectedStudentForWa, setSelectedStudentForWa] = useState<Student | null>(null);
  const [selectedIncidentForWa, setSelectedIncidentForWa] = useState<Incident | null>(null);

  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState<boolean>(false);
  const [selectedIncidentForAction, setSelectedIncidentForAction] = useState<Incident | null>(null);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.className.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

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

  const handleSaveIncident = (data: {
    studentId: string;
    category: CategoryType;
    priority: PriorityType;
    description: string;
    actionTaken: string;
  }) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newInc: Incident = {
      id: `inc-${Date.now()}`,
      studentId: data.studentId,
      category: data.category,
      priority: data.priority,
      description: data.description,
      actionTaken: data.actionTaken,
      status: 'Pending',
      createdAt: formattedDate,
      teacherName: 'Bu Guru Ana',
      followUpLogs: [],
    };

    setIncidents([newInc, ...incidents]);
    setIsNewIncidentModalOpen(false);
    Alert.alert('Sukses', 'Catatan baru berhasil disimpan!');
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

  const handleSaveFollowUp = (updatedStatus: StatusType, updateNote: string) => {
    if (!selectedIncidentForAction) return;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const updatedIncidents = incidents.map((inc) => {
      if (inc.id === selectedIncidentForAction.id) {
        const newLogs = [...inc.followUpLogs];
        if (updateNote.trim()) {
          newLogs.push({
            id: `f-${Date.now()}`,
            note: updateNote.trim(),
            updatedAt: formattedDate,
          });
        }
        return {
          ...inc,
          status: updatedStatus,
          followUpLogs: newLogs,
        };
      }
      return inc;
    });

    setIncidents(updatedIncidents);
    setIsFollowUpModalOpen(false);
    Alert.alert('Berhasil', 'Status dan tindak lanjut berhasil diperbarui.');
  };

  const renderStudentList = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama siswa atau kelas..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Siswa tidak ditemukan.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.studentCard}
            onPress={() => setSelectedStudentId(item.id)}
          >
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{item.avatar}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentClass}>{item.className}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

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
            renderStudentList()
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
  tabContent: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  studentClass: {
    fontSize: 12,
    color: '#6B7280',
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
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
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
});
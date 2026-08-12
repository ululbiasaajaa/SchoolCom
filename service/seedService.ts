import {
    collection,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Incident, Student } from '../types/schoolcom';

// Baseline Data
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

/**
 * Memasukkan data baseline ke Cloud Firestore (One-time Execution)
 */
export const seedInitialData = async (): Promise<boolean> => {
  try {
    const studentSnapshot = await getDocs(collection(db, 'students'));
    if (!studentSnapshot.empty) {
      console.log('🌱 Data sudah terisi di Firestore. Seeding dilewati.');
      return false;
    }

    console.log('🌱 Memulai seeding data baseline...');

    // 1. Seed Students
    for (const student of INITIAL_STUDENTS) {
      const { id, ...data } = student;
      await setDoc(doc(db, 'students', id), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 2. Seed Incidents
    for (const incident of INITIAL_INCIDENTS) {
      const { id, ...data } = incident;
      await setDoc(doc(db, 'incidents', id), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    console.log('✅ Seeding data baseline ke Firestore BERHASIL!');
    return true;
  } catch (error) {
    console.error('❌ Error saat seeding data:', error);
    throw error;
  }
};
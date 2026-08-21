import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Parent, Student } from '../types/schoolcom';

const STUDENTS_COLLECTION = 'students';

// Data default lengkap dengan field gender
const INITIAL_STUDENTS: Student[] = [
  {
    id: 's1',
    name: 'Aisyah Putri',
    className: 'Kelas TK-A',
    avatar: '👧',
    gender: 'F', // Fix: Perempuan
    dob: '2021-04-10',
    parents: [{ name: 'Ibu Aisyah', phone: '6281234567890', relationship: 'Ibu' }],
  },
  {
    id: 's2',
    name: 'Ananda Pratama',
    className: 'Kelas TK-A',
    avatar: '👦',
    gender: 'M', // Fix: Laki-laki
    dob: '2021-08-22',
    parents: [{ name: 'Bapak Ananda', phone: '6289876543210', relationship: 'Ayah' }],
  },
  {
    id: 's3',
    name: 'Kenzo Alfarizi',
    className: 'Kelas TK-A',
    avatar: '🧒',
    gender: 'M', // Fix: Laki-laki
    dob: '2021-01-15',
    parents: [{ name: 'Ibu Kenzo', phone: '628555444333', relationship: 'Ibu' }],
  },
  {
    id: 's4',
    name: 'Rasyid',
    className: 'Kelas TK-A',
    avatar: '👦',
    gender: 'M', // Fix: Laki-laki
    dob: '2021-06-15',
    parents: [
      {
        name: 'Orang Tua Rasyid',
        phone: '62895414781707',
        relationship: 'Orang Tua / Wali',
      },
    ],
  },
];

// Seed serentak dengan writeBatch agar masuk sekaligus ke Firestore jika DB kosong
const autoSeedIfEmpty = async (currentData: Student[]) => {
  if (currentData.length === 0) {
    console.log('Database kosong, melakukan auto-seed batch data siswa...');
    try {
      const batch = writeBatch(db);
      INITIAL_STUDENTS.forEach((student) => {
        const studentRef = doc(db, STUDENTS_COLLECTION, student.id);
        batch.set(studentRef, student);
      });
      await batch.commit();
      console.log('Auto-seed batch berhasil!');
    } catch (err: unknown) {
      console.error('Gagal auto-seed data siswa:', err);
    }
  }
};

/**
 * Realtime Listener Data Siswa (Batch & Anti Kedap-Kedip)
 */
export const subscribeToStudents = (callback: (students: Student[]) => void) => {
  const colRef = collection(db, STUDENTS_COLLECTION);

  return onSnapshot(
    colRef,
    { includeMetadataChanges: false },
    (snapshot) => {
      const studentsData: Student[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        
        // Smart fallback gender jika data di Firestore belum punya field gender
        const inferredGender = data.gender 
          ? data.gender 
          : (data.avatar === '👧' ? 'F' : 'M');

        const rawParents = (data.parents || []) as Record<string, unknown>[];
        const formattedParents: Parent[] = rawParents.map((p) => ({
          name: typeof p.name === 'string' ? p.name : '',
          phone: typeof p.phone === 'string' ? p.phone : '',
          relationship: typeof p.relationship === 'string' 
            ? p.relationship 
            : (typeof p.relation === 'string' ? p.relation : 'Wali'),
        }));

        return {
          id: docSnap.id,
          name: typeof data.name === 'string' ? data.name : '',
          className: typeof data.className === 'string' ? data.className : '',
          avatar: typeof data.avatar === 'string' ? data.avatar : '👦',
          gender: inferredGender, // Fix: Gender ter-mapping dengan aman!
          dob: typeof data.dob === 'string' ? data.dob : '',
          parents: formattedParents,
        };
      });

      // Urutkan siswa berdasarkan nama
      studentsData.sort((a, b) => a.name.localeCompare(b.name));

      if (studentsData.length === 0) {
        autoSeedIfEmpty(studentsData);
      }

      callback(studentsData);
    },
    (error: unknown) => {
      console.error('Error listening to students:', error);
    }
  );
};

// ==========================================
// MANAGEMENT FEATURES (ADMIN ONLY)
// ==========================================

export type StudentInput = Omit<Student, 'id'>;

/**
 * Tambah Siswa Baru (Admin Only)
 */
export const addStudent = async (studentData: StudentInput): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, STUDENTS_COLLECTION), {
      ...studentData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error: unknown) {
    console.error('Error adding student:', error);
    throw error;
  }
};

/**
 * Update Data Siswa (Admin Only)
 */
export const updateStudent = async (studentId: string, studentData: Partial<StudentInput>): Promise<void> => {
  try {
    const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
    await updateDoc(studentRef, {
      ...studentData,
      updatedAt: serverTimestamp(),
    });
  } catch (error: unknown) {
    console.error('Error updating student:', error);
    throw error;
  }
};

/**
 * Hapus Siswa (Admin Only)
 */
export const deleteStudent = async (studentId: string): Promise<void> => {
  try {
    const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
    await deleteDoc(studentRef);
  } catch (error: unknown) {
    console.error('Error deleting student:', error);
    throw error;
  }
};
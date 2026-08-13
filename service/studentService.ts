import { collection, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Student } from '../types/schoolcom';

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
    } catch (err) {
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

        return {
          id: docSnap.id,
          name: data.name || '',
          className: data.className || '',
          avatar: data.avatar || '👦',
          gender: inferredGender, // Fix: Gender ter-mapping dengan aman!
          dob: data.dob || '',
          parents: (data.parents || []).map((p: any) => ({
            name: p.name || '',
            phone: p.phone || '',
            relationship: p.relationship || p.relation || 'Wali',
          })),
        };
      });

      // Urutkan siswa berdasarkan nama
      studentsData.sort((a, b) => a.name.localeCompare(b.name));

      if (studentsData.length === 0) {
        autoSeedIfEmpty(studentsData);
      }

      callback(studentsData);
    },
    (error) => {
      console.error('Error listening to students:', error);
    }
  );
};
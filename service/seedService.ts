import {
  doc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Student } from '../types/schoolcom';

// Baseline & Tester Data
const TESTER_STUDENT: Student = {
  id: 's4',
  name: 'Rasyid',
  avatar: '👦',
  gender: 'M', // Fix: Diberi 'M' (Laki-laki) agar UI gender valid
  className: 'TK-A Bintang',
  dob: '2021-06-15', // Usia ~5 tahun pada 2026
  parents: [
    {
      name: 'Wali Rasyid',
      relationship: 'Orang Tua / Wali',
      phone: '62895414781707', // Format internasional kompatibel dengan WhatsApp Flow
    },
  ],
};

/**
 * Menambahkan Data Siswa Tester Rasyid ke Cloud Firestore
 */
export const seedRasyidStudent = async (): Promise<boolean> => {
  try {
    const { id, ...data } = TESTER_STUDENT;
    
    // Simpan/overwrite dokumen s4 tanpa mengganggu s1, s2, s3
    await setDoc(
      doc(db, 'students', id),
      {
        ...data,
        updatedAt: serverTimestamp(),
        // serverTimestamp() untuk createdAt diset saat dokumen pertama kali dibuat
        createdAt: serverTimestamp(),
      },
      { merge: true } // Mencegah data terhapus jika dire-seed
    );

    console.log('✅ Data Siswa Tester (Rasyid) BERHASIL ditambahkan ke Firestore!');
    return true;
  } catch (error: unknown) {
    console.error('❌ Error saat menambahkan data Rasyid:', error);
    throw error;
  }
};
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PILOT_SCHOOL_ID } from '../constants/school';
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
 *
 * FIX BUG: Versi sebelumnya menulis `createdAt: serverTimestamp()` bersamaan dengan
 * `{ merge: true }` di SETIAP pemanggilan. Padahal `merge: true` tidak membuat Firestore
 * "skip" field yang eksplisit dikirim — field itu tetap ditimpa. Jadi setiap kali fungsi ini
 * dipanggil ulang (misal re-seed manual), `createdAt` ikut ke-reset ke waktu sekarang,
 * padahal niatnya cuma diset sekali pas dokumen pertama kali dibuat.
 *
 * Sekarang: cek dulu apakah dokumen sudah ada. Kalau sudah ada, `createdAt` TIDAK dikirim
 * ulang (biar nilai lama tetap dipertahankan oleh merge). Kalau belum ada, baru di-set.
 */
export const seedRasyidStudent = async (): Promise<boolean> => {
  try {
    const { id, ...data } = TESTER_STUDENT;
    const docRef = doc(db, 'students', id);

    const existingSnap = await getDoc(docRef);
    const isFirstTimeCreation = !existingSnap.exists();

    await setDoc(
      docRef,
      {
        ...data,
        // Fondasi multi-sekolah — lihat constants/school.ts
        schoolId: PILOT_SCHOOL_ID,
        updatedAt: serverTimestamp(),
        // createdAt HANYA dikirim kalau dokumen belum pernah ada sebelumnya
        ...(isFirstTimeCreation ? { createdAt: serverTimestamp() } : {}),
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
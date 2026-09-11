import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { EducationLevel, SchoolClass } from '../types/schoolcom';

const CLASSES_COLLECTION = 'classes';

export type SchoolClassInput = Omit<SchoolClass, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Realtime listener SEMUA kelas (Admin View).
 */
export const subscribeToClasses = (callback: (classes: SchoolClass[]) => void) => {
  const q = query(collection(db, CLASSES_COLLECTION), orderBy('name', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const classes = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SchoolClass, 'id'>),
      }));
      callback(classes);
    },
    (error: unknown) => {
      console.error('Error subscribing to classes:', error);
      callback([]);
    }
  );
};

/**
 * Realtime listener kelas berdasarkan jenjang tertentu.
 * Dipakai buat Phase 26 (Education-Level Feature Gating) — misal filter
 * cuma kelas TK yang ditampilkan di form config yang khusus TK.
 */
export const subscribeToClassesByLevel = (
  educationLevel: EducationLevel,
  callback: (classes: SchoolClass[]) => void
) => {
  const q = query(
    collection(db, CLASSES_COLLECTION),
    where('educationLevel', '==', educationLevel)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const classes = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SchoolClass, 'id'>),
      }));
      callback(classes);
    },
    (error: unknown) => {
      console.error(`Error subscribing to classes for level ${educationLevel}:`, error);
      callback([]);
    }
  );
};

/**
 * Tambah Kelas Baru (Admin Only)
 */
export const createClass = async (classData: SchoolClassInput): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, CLASSES_COLLECTION), {
      ...classData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error: unknown) {
    console.error('Error creating class:', error);
    throw error;
  }
};

/**
 * Update Kelas (Admin Only)
 */
export const updateClass = async (
  classId: string,
  classData: Partial<SchoolClassInput>
): Promise<void> => {
  try {
    const classRef = doc(db, CLASSES_COLLECTION, classId);
    await updateDoc(classRef, {
      ...classData,
      updatedAt: serverTimestamp(),
    });
  } catch (error: unknown) {
    console.error('Error updating class:', error);
    throw error;
  }
};

/**
 * Hapus Kelas (Admin Only)
 *
 * CATATAN: Sesuai pelajaran dari kasus `deleteStudentCascade`, hapus kelas TIDAK
 * otomatis menghapus/mindahin siswa yang masih terhubung ke classId ini. Sebelum
 * dipanggil, UI wajib mastiin dulu gak ada siswa aktif yang masih menunjuk ke
 * classId ini (mirip validasi FK di SQL) — kalau perlu, tambahkan pengecekan
 * count siswa di kelas ini sebelum tombol hapus bisa ditekan.
 */
export const deleteClass = async (classId: string): Promise<void> => {
  try {
    const classRef = doc(db, CLASSES_COLLECTION, classId);
    await deleteDoc(classRef);
  } catch (error: unknown) {
    console.error('Error deleting class:', error);
    throw error;
  }
};
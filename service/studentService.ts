import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    Unsubscribe,
    updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Student } from '../types/schoolcom';

const STUDENTS_COLLECTION = 'students';

// Helper internal untuk mengonversi data Firestore ke type Student
const mapStudentDoc = (docSnap: any): Student => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name || '',
    avatar: data.avatar || '👦',
    className: data.className || '',
    dob: data.dob || '',
    parents: data.parents || [],
  };
};

/**
 * Realtime Listener untuk daftar siswa
 */
export const subscribeToStudents = (
  callback: (students: Student[]) => void
): Unsubscribe => {
  const q = query(collection(db, STUDENTS_COLLECTION), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const students = snapshot.docs.map(mapStudentDoc);
      callback(students);
    },
    (error) => {
      console.error('Error in subscribeToStudents:', error);
    }
  );
};

/**
 * Mengambil seluruh daftar siswa diurutkan berdasarkan nama (One-time fetch)
 */
export const getStudents = async (): Promise<Student[]> => {
  const q = query(collection(db, STUDENTS_COLLECTION), orderBy('name', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapStudentDoc);
};

/**
 * Mengambil data detail siswa berdasarkan document ID
 */
export const getStudentById = async (studentId: string): Promise<Student | null> => {
  const docRef = doc(db, STUDENTS_COLLECTION, studentId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return mapStudentDoc(docSnap);
};

/**
 * Menambahkan data siswa baru ke koleksi students
 */
export const addStudent = async (
  studentData: Omit<Student, 'id'>
): Promise<string> => {
  const docRef = await addDoc(collection(db, STUDENTS_COLLECTION), {
    ...studentData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Memperbarui data siswa berdasarkan document ID
 */
export const updateStudent = async (
  studentId: string,
  data: Partial<Omit<Student, 'id'>>
): Promise<void> => {
  const docRef = doc(db, STUDENTS_COLLECTION, studentId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};
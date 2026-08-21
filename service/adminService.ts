import { deleteApp, initializeApp } from 'firebase/app';
import {
    createUserWithEmailAndPassword,
    deleteUser,
    User as FirebaseUser,
    getAuth,
} from 'firebase/auth';
import {
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../config/firebase';
import { Student, User } from '../types/schoolcom';

export interface CreateUserDTO {
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'parent';
  temporaryPassword?: string;
  classes?: string[];
  studentIds?: string[];
}

export interface CreateStudentDTO {
  name: string;
  className: string;
  avatar?: string;
}

export interface CreateUserResult {
  uid: string;
  temporaryPassword: string;
}

/**
 * Helper untuk menghasilkan password sementara acak & aman.
 * Mencegah prediksi password bawaan pada akun baru.
 */
const generateTempPassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let pass = '';
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

/**
 * 1. ATOMIC CREATION USER (Secondary Auth App + Firestore Document)
 * Dilengkapi generator password acak, pengembalian credential untuk Admin,
 * serta isolasi rollback atomic jika penulisan Firestore gagal.
 */
export const createManagedUser = async (userData: CreateUserDTO): Promise<CreateUserResult> => {
  const secondaryApp = initializeApp(firebaseConfig, `SecondaryAuthApp_${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  let createdAuthUser: FirebaseUser | null = null;
  let isFirestoreSuccess = false;

  // Gunakan password buatan Admin jika diisi, atau generate password acak unik
  const activePassword = userData.temporaryPassword || generateTempPassword();

  try {
    // A. Buat Akun Firebase Auth di Secondary Instance
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      userData.email,
      activePassword
    );
    createdAuthUser = userCredential.user;

    // B. Buat Dokumen Firestore users/{uid}
    const newUserDoc = {
      uid: createdAuthUser.uid,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      createdAt: new Date().toISOString(),
      ...(userData.classes ? { classes: userData.classes } : {}),
      ...(userData.studentIds ? { studentIds: userData.studentIds } : {}),
    };

    await setDoc(doc(db, 'users', createdAuthUser.uid), newUserDoc);
    isFirestoreSuccess = true;

  } catch (error) {
    // CRITICAL ROLLBACK: Hanya jika Auth sukses tetapi Firestore gagal
    if (createdAuthUser && !isFirestoreSuccess) {
      try {
        await deleteUser(createdAuthUser);
      } catch (rollbackError) {
        console.error('CRITICAL: Rollback Auth deletion failed:', rollbackError);
      }
    }

    // Cleanup secondary app jika gagal pada critical phase
    try {
      await deleteApp(secondaryApp);
    } catch (cleanupError) {
      /* ignore non-critical error */
    }

    throw error;
  }

  // C. NON-CRITICAL CLEANUP PHASE
  try {
    await deleteApp(secondaryApp);
  } catch (cleanupError) {
    console.warn('Non-critical: Secondary app cleanup failed, user remains valid:', cleanupError);
  }

  // Kembalikan UID dan Password Aktif agar UI Admin dapat menampilkan/menyalinnya
  return {
    uid: createdAuthUser!.uid,
    temporaryPassword: activePassword,
  };
};

/**
 * 2. USER & TEACHER MANAGEMENT SERVICES
 */
export const subscribeToAllUsers = (callback: (users: User[]) => void) => {
  const q = query(collection(db, 'users'));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<User, 'id'>;
      return {
        id: docSnap.id,
        ...data,
      } as User;
    });
    callback(users);
  });
};

export const updateUserRole = async (userId: string, newRole: 'admin' | 'teacher' | 'parent') => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { role: newRole });
};

export const updateUserClasses = async (userId: string, classes: string[]) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { classes });
};

export const linkParentToStudent = async (parentId: string, studentId: string) => {
  const parentRef = doc(db, 'users', parentId);
  await updateDoc(parentRef, {
    studentIds: arrayUnion(studentId),
  });
};

export const unlinkParentFromStudent = async (parentId: string, studentId: string) => {
  const parentRef = doc(db, 'users', parentId);
  await updateDoc(parentRef, {
    studentIds: arrayRemove(studentId),
  });
};

/**
 * 3. STUDENT MANAGEMENT SERVICES
 */
export const subscribeToAllStudents = (callback: (students: Student[]) => void) => {
  const q = query(collection(db, 'students'), orderBy('name', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const students = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<Student, 'id'>;
      return {
        id: docSnap.id,
        ...data,
      } as Student;
    });
    callback(students);
  });
};

export const createStudent = async (studentData: CreateStudentDTO): Promise<string> => {
  const newStudentRef = doc(collection(db, 'students'));
  await setDoc(newStudentRef, {
    ...studentData,
    createdAt: new Date().toISOString(),
  });
  return newStudentRef.id;
};

export const updateStudent = async (studentId: string, studentData: Partial<Student>) => {
  const studentRef = doc(db, 'students', studentId);
  await updateDoc(studentRef, studentData);
};

export const deleteStudent = async (studentId: string) => {
  const studentRef = doc(db, 'students', studentId);
  await deleteDoc(studentRef);
};
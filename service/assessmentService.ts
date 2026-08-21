import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AssessmentConfig, StudentAssessment } from '../types/schoolcom';

// ==========================================
// HELPER INTERNAL: FIRESTORE SAFE DOCUMENT ID GENERATOR
// ==========================================

/**
 * Mengubah string academicYear ("2026/2027") & term ("Semester 1")
 * menjadi string yang aman dari delimiter path Firestore ('/').
 */
const getSafeConfigId = (academicYear: string, term: string): string => {
  const safeYear = academicYear.replace(/\//g, '-');
  const safeTerm = term.replace(/\s+/g, '_');
  return `${safeYear}_${safeTerm}`;
};

/**
 * Mengubah kombinasi id assessment menjadi string ID dokumen yang aman.
 */
const getSafeAssessmentId = (
  academicYear: string,
  term: string,
  studentId: string,
  subjectId: string
): string => {
  const safeConfigId = getSafeConfigId(academicYear, term);
  return `${safeConfigId}_${studentId}_${subjectId}`;
};

// ==========================================
// 1. ASSESSMENT CONFIG FUNCTIONS (ADMIN WRITE, TEACHER/ADMIN READ)
// ==========================================

/**
 * Mengambil konfigurasi penilaian berdasarkan tahun ajaran dan semester.
 * Document ID deterministik: {academicYear}_{term} (Sanitized)
 */
export const getAssessmentConfig = async (
  academicYear: string,
  term: string
): Promise<AssessmentConfig | null> => {
  try {
    const docId = getSafeConfigId(academicYear, term);
    const docRef = doc(db, 'assessmentConfigs', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as AssessmentConfig;
    }
    return null;
  } catch (error: unknown) {
    console.error(`Error fetching assessment config for ${academicYear}_${term}:`, error);
    throw error;
  }
};

/**
 * Menyimpan atau memperbarui konfigurasi penilaian.
 * Document ID deterministik: {academicYear}_{term} (Sanitized)
 */
export const saveAssessmentConfig = async (
  config: AssessmentConfig
): Promise<void> => {
  try {
    const docId = getSafeConfigId(config.academicYear, config.term);
    const docRef = doc(db, 'assessmentConfigs', docId);

    await setDoc(
      docRef,
      {
        ...config,
        id: docId,
        updatedAt: config.updatedAt || new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error: unknown) {
    console.error('Error saving assessment config:', error);
    throw error;
  }
};

/**
 * Realtime listener untuk membaca perubahan konfigurasi penilaian per periode.
 */
export const subscribeToAssessmentConfig = (
  academicYear: string,
  term: string,
  callback: (config: AssessmentConfig | null) => void
) => {
  const docId = getSafeConfigId(academicYear, term);
  const docRef = doc(db, 'assessmentConfigs', docId);

  const unsubscribe = onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as AssessmentConfig);
      } else {
        callback(null);
      }
    },
    (error: unknown) => {
      console.error(`Error subscribing to assessment config ${docId}:`, error);
    }
  );

  return unsubscribe;
};

// ==========================================
// 2. STUDENT ASSESSMENT FUNCTIONS (BATCH WRITE & REALTIME SUBSCRIPTION)
// ==========================================

/**
 * Menyimpan sekelompok penilaian siswa (batch write) dengan ID deterministik.
 * Document ID deterministik: {academicYear}_{term}_{studentId}_{subjectId} (Sanitized)
 */
export const saveAssessmentBatch = async (
  assessments: Omit<StudentAssessment, 'id'>[]
): Promise<void> => {
  try {
    const batch = writeBatch(db);

    assessments.forEach((item) => {
      const docId = getSafeAssessmentId(
        item.academicYear,
        item.term,
        item.studentId,
        item.subjectId
      );
      const docRef = doc(db, 'assessments', docId);

      const recordToSave: StudentAssessment = {
        ...item,
        id: docId,
        score: item.score !== undefined ? item.score : null,
        predicate: item.predicate !== undefined ? item.predicate : null,
        narrative: item.narrative !== undefined ? item.narrative : null,
      };

      batch.set(docRef, recordToSave, { merge: true });
    });

    await batch.commit();
  } catch (error: unknown) {
    console.error('Error saving assessment batch:', error);
    throw error;
  }
};

/**
 * Realtime listener untuk membaca daftar penilaian siswa berdasarkan periode (academicYear & term).
 * Digunakan untuk Teacher Assessment View (Sekelas).
 */
export const subscribeToAssessments = (
  academicYear: string,
  term: string,
  callback: (records: StudentAssessment[]) => void
) => {
  const q = query(
    collection(db, 'assessments'),
    where('academicYear', '==', academicYear),
    where('term', '==', term)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const records: StudentAssessment[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as StudentAssessment);
      });
      callback(records);
    },
    (error: unknown) => {
      console.error(`Error subscribing to assessments (${academicYear} - ${term}):`, error);
    }
  );

  return unsubscribe;
};

/**
 * Realtime listener khusus untuk membaca data penilaian 1 siswa tertentu (Read-Only).
 * Digunakan khusus untuk Parent Experience Layer (Tahap 9A).
 */
export const subscribeToStudentAssessments = (
  studentId: string,
  academicYear: string,
  term: string,
  callback: (records: StudentAssessment[]) => void
) => {
  const q = query(
    collection(db, 'assessments'),
    where('studentId', '==', studentId),
    where('academicYear', '==', academicYear),
    where('term', '==', term)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const records: StudentAssessment[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as StudentAssessment);
      });
      callback(records);
    },
    (error: unknown) => {
      console.error(`Error subscribing to student assessments for ${studentId}:`, error);
    }
  );

  return unsubscribe;
};

/**
 * Realtime listener untuk mengambil SELURUH riwayat penilaian siswa lintas periode.
 * Digunakan untuk Parent History View.
 */
export const subscribeToAllStudentAssessments = (
  studentId: string,
  callback: (assessments: StudentAssessment[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'assessments'),
    where('studentId', '==', studentId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: StudentAssessment[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as StudentAssessment);
      });
      callback(records);
    },
    (error: unknown) => {
      console.error(`Error subscribing to all assessments for student ${studentId}:`, error);
    }
  );
};
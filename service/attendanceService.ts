import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PILOT_SCHOOL_ID } from '../constants/school';

export type AttendanceStatus = 'Present' | 'Absent' | 'Sick' | 'Permission' | 'Late';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  className?: string; // Optional untuk backward compatibility
  date: string;
  status: AttendanceStatus;
  teacherName: string;
  updatedAt: string;
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  schoolId?: string;
}

// 1. Save Attendance Batch dengan deterministik ID {date}_{studentId}
export const saveAttendanceBatch = async (
  records: Omit<AttendanceRecord, 'id' | 'date'>[],
  date: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);

    records.forEach((record) => {
      const docId = `${date}_${record.studentId}`;
      const docRef = doc(db, 'attendance', docId);

      batch.set(
        docRef,
        {
          id: docId,
          studentId: record.studentId,
          studentName: record.studentName,
          ...(record.className ? { className: record.className } : {}),
          date: date, // Single Source of Truth dari parameter date
          status: record.status,
          teacherName: record.teacherName,
          updatedAt: record.updatedAt,
          // Fondasi multi-sekolah — lihat constants/school.ts
          schoolId: PILOT_SCHOOL_ID,
        },
        { merge: true }
      );
    });

    await batch.commit();
  } catch (error: unknown) {
    console.error('Error saving attendance batch:', error);
    throw error;
  }
};

// 2A. Realtime subscription absensi global berdasarkan tanggal (untuk Admin/Global View)
export const subscribeToAttendance = (
  date: string,
  callback: (records: AttendanceRecord[]) => void
) => {
  const q = query(collection(db, 'attendance'), where('date', '==', date));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as AttendanceRecord);
      });
      callback(records);
    },
    (error: unknown) => {
      console.error('Error subscribing to attendance:', error);
      callback([]);
    }
  );

  return unsubscribe;
};

// 2B. Realtime subscription absensi terisolasi per KELAS & TANGGAL (untuk Teacher Bulk Workflow)
//
// CATATAN PENTING (bukan bug kode, tapi jebakan deploy yang sering kelewat):
// Query ini pakai where('date', ...) DAN where('className', ...) sekaligus (compound query
// dua field berbeda). Firestore WAJIB punya composite index untuk kombinasi field ini,
// kalau belum dibuat manual di Firebase Console (Firestore > Indexes), function ini akan
// throw runtime error "The query requires an index" saat pertama kali dipanggil.
// Firestore biasanya kasih link otomatis di error message untuk generate index-nya.
export const subscribeToAttendanceByClass = (
  date: string,
  className: string,
  callback: (records: AttendanceRecord[]) => void
) => {
  const q = query(
    collection(db, 'attendance'),
    where('date', '==', date),
    where('className', '==', className)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as AttendanceRecord);
      });
      callback(records);
    },
    (error: unknown) => {
      console.error(`Error subscribing to attendance for class ${className}:`, error);
      callback([]);
    }
  );

  return unsubscribe;
};

// ==========================================
// 3. READ-ONLY HELPER UNTUK PARENT LAYER
// ==========================================

/**
 * Realtime listener khusus untuk membaca histori presensi 1 siswa (Read-Only).
 * Digunakan untuk Parent Experience Layer.
 */
export const subscribeToStudentAttendance = (
  studentId: string,
  callback: (records: AttendanceRecord[]) => void
) => {
  const q = query(
    collection(db, 'attendance'),
    where('studentId', '==', studentId)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as AttendanceRecord);
      });
      callback(records);
    },
    (error: unknown) => {
      console.error(`Error subscribing to attendance for student ${studentId}:`, error);
      callback([]);
    }
  );

  return unsubscribe;
};
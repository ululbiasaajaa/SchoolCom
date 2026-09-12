import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PILOT_SCHOOL_ID } from '../constants/school';
import { Parent, Student } from '../types/schoolcom';

const STUDENTS_COLLECTION = 'students';

// Guard modul: memastikan pengecekan/penulisan auto-seed cuma berjalan SEKALI
// per lifecycle aplikasi, bukan setiap kali onSnapshot menembak data kosong.
let hasCheckedSeedFlag = false;

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

/**
 * FIX BUG: Sebelumnya, auto-seed dipicu SETIAP KALI koleksi 'students' kosong,
 * termasuk kalau admin sengaja menghapus seluruh siswa (misal lulus semua/pindah sekolah).
 * Realtime listener akan langsung nembak batch seed lagi dan data dummy
 * (Aisyah, Ananda, Kenzo, Rasyid) muncul lagi tiba-tiba tanpa diminta.
 *
 * Fix-nya: gunakan dokumen penanda 'meta/seedStatus' di Firestore untuk membedakan
 * "belum pernah di-seed sama sekali" vs "sudah pernah di-seed, lalu memang dikosongkan lagi".
 * Auto-seed HANYA jalan kalau penanda ini belum pernah ada.
 */
const autoSeedIfEmpty = async (currentData: Student[]) => {
  if (currentData.length !== 0) return;
  if (hasCheckedSeedFlag) return; // Sudah pernah dicek di sesi ini, jangan cek ulang berkali-kali

  hasCheckedSeedFlag = true;

  try {
    const seedFlagRef = doc(db, 'meta', 'studentSeedStatus');
    const existingSeeds = await getDocs(collection(db, STUDENTS_COLLECTION));

    // Double-check langsung ke server (bukan cache) sebelum memutuskan seed,
    // untuk menghindari race condition dari snapshot lokal yang sempat kosong sesaat.
    if (existingSeeds.size > 0) return;

    const batch = writeBatch(db);
    console.log('Database kosong & belum pernah di-seed, melakukan auto-seed batch data siswa...');

    INITIAL_STUDENTS.forEach((student) => {
      const studentRef = doc(db, STUDENTS_COLLECTION, student.id);
      // Fondasi multi-sekolah — lihat constants/school.ts
      batch.set(studentRef, { ...student, schoolId: PILOT_SCHOOL_ID });
    });
    batch.set(seedFlagRef, { seededAt: serverTimestamp() });

    await batch.commit();
    console.log('Auto-seed batch berhasil!');
  } catch (err: unknown) {
    console.error('Gagal auto-seed data siswa:', err);
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
          // FIX BUG: field ini sebelumnya gak di-list di sini, jadi classId hasil
          // migrateClassNamesToClasses() (Phase 22) selalu ke-drop diam-diam walau
          // datanya udah bener tersimpan di Firestore. Akibatnya fitur yang butuh
          // classId (misal tombol "Nilai Harian" di TeacherAssessmentView) selalu
          // nganggap siswa belum termigrasi walau sebenarnya sudah.
          classId: typeof data.classId === 'string' ? data.classId : undefined,
          schoolId: typeof data.schoolId === 'string' ? data.schoolId : undefined,
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
      // Fondasi multi-sekolah — lihat constants/school.ts
      schoolId: PILOT_SCHOOL_ID,
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
 * Hapus Siswa SAJA (Admin Only) — TIDAK cascade ke data terkait.
 * @deprecated Gunakan `deleteStudentCascade` supaya data assessments/attendance/incidents
 * milik siswa ini dan link di dokumen parent ikut dibersihkan. Fungsi ini dipertahankan
 * hanya untuk kompatibilitas kode lama yang mungkin masih memanggilnya.
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

/**
 * FIX BUG: Hapus Siswa BESERTA seluruh data terkait (cascade), Admin Only.
 *
 * Sebelumnya `deleteStudent` cuma menghapus dokumen `students/{id}` saja. Record
 * `assessments`, `attendance`, dan `incidents` milik siswa itu TIDAK ikut terhapus dan
 * jadi data yatim (nunjuk ke studentId yang sudah tidak ada) yang menumpuk selamanya di
 * Firestore. Selain itu, referensi siswa di field `studentIds` pada dokumen parent yang
 * terhubung juga tidak ikut diputus, sehingga parent tetap "terhubung" ke ID yang mati.
 *
 * Fungsi ini membersihkan semuanya sekaligus dalam satu batch:
 * 1. Semua dokumen `assessments` dengan studentId ini
 * 2. Semua dokumen `attendance` dengan studentId ini
 * 3. Semua dokumen `incidents` dengan studentId ini
 * 4. `arrayRemove(studentId)` dari field `studentIds` setiap parent yang tertaut
 * 5. Dokumen `students/{id}` itu sendiri
 *
 * Catatan: Firestore batch dibatasi maksimal 500 operasi. Untuk skala data satu sekolah
 * (puluhan-ratusan record per siswa) ini jauh di bawah limit tersebut; kalau di masa depan
 * volume data per siswa bisa jauh lebih besar, batch ini perlu dipecah jadi beberapa chunk.
 */
export const deleteStudentCascade = async (studentId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // 1. Cari & hapus semua assessments milik siswa ini
    const assessmentsSnap = await getDocs(
      query(collection(db, 'assessments'), where('studentId', '==', studentId))
    );
    assessmentsSnap.forEach((docSnap) => batch.delete(docSnap.ref));

    // 2. Cari & hapus semua attendance milik siswa ini
    const attendanceSnap = await getDocs(
      query(collection(db, 'attendance'), where('studentId', '==', studentId))
    );
    attendanceSnap.forEach((docSnap) => batch.delete(docSnap.ref));

    // 3. Cari & hapus semua incidents milik siswa ini
    const incidentsSnap = await getDocs(
      query(collection(db, 'incidents'), where('studentId', '==', studentId))
    );
    incidentsSnap.forEach((docSnap) => batch.delete(docSnap.ref));

    // 4. Putuskan link dari parent yang studentIds-nya mengandung siswa ini
    const parentsSnap = await getDocs(
      query(collection(db, 'users'), where('studentIds', 'array-contains', studentId))
    );
    parentsSnap.forEach((docSnap) => {
      batch.update(docSnap.ref, { studentIds: arrayRemove(studentId) });
    });

    // 5. Hapus dokumen siswa itu sendiri
    batch.delete(doc(db, STUDENTS_COLLECTION, studentId));

    await batch.commit();
  } catch (error: unknown) {
    console.error('Error cascading delete for student:', error);
    throw error;
  }
};
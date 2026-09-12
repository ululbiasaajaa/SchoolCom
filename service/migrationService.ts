import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PILOT_SCHOOL_ID } from '../constants/school';
import { EducationLevel } from '../types/schoolcom';

/**
 * MIGRASI SATU KALI (Phase 22) — jalankan lewat tombol admin khusus (mirip pola
 * `seedRasyidStudent` di seedService.ts), BUKAN dipanggil otomatis tiap app dibuka.
 *
 * STRATEGI: "Expand" migration, bukan "replace". Field `className` (string) di
 * Student dan `classes` (string[]) di User (guru) TETAP DIBIARKAN APA ADANYA —
 * karena hampir semua kode V1 yang udah stabil & lolos QA (StudentListView,
 * attendanceService, TeacherDashboardView, dst) masih baca dari field itu
 * langsung. Migrasi ini cuma NAMBAH field baru (`classId` di Student,
 * `classIds` di User guru) yang nunjuk ke collection `classes` yang baru dibikin.
 *
 * Kode V2/V3 baru (Phase 23 ke atas) baca dari `classId`/`classIds` yang baru.
 * Kode V1 lama tetap jalan seperti biasa tanpa disentuh sama sekali.
 *
 * PENTING SETELAH MIGRASI JALAN: cek satu-satu dokumen di collection `classes`
 * yang baru dibuat — `educationLevel`, `academicYear`, dan `homeroomTeacherId`
 * di-generate pakai NILAI DEFAULT (karena migrasi ini gak bisa nebak itu semua
 * dengan pasti dari data string lama). Admin WAJIB koreksi manual lewat
 * `updateClass()` setelah migrasi selesai kalau ada kelas yang levelnya
 * bukan default.
 */

export interface BackfillSchoolIdResult {
  perCollection: Record<string, number>;
  totalStamped: number;
}

// Semua collection yang butuh schoolId, sesuai daftar field opsional yang udah
// ditambahin ke types/schoolcom.ts.
//
// CATATAN: 'pushTokens' SENGAJA gak dimasukin ke daftar ini. Beda dengan
// collection lain, rules create/update 'pushTokens' gak punya bypass isAdmin()
// — cuma PEMILIK token itu sendiri (request.auth.uid == targetUid) yang boleh
// nulis ke dokumennya. Kalau tetep dipaksa di-backfill dari sisi admin,
// writeBatch bakal ditolak Firestore ("Missing or insufficient permissions")
// begitu nyoba nulis ke token milik user lain. Untungnya gak perlu dipaksa:
// registerForPushNotificationsAsync() (dipanggil otomatis tiap login) udah
// nyetempel schoolId ke token miliknya sendiri — jadi tokens lama otomatis
// "self-heal" begitu user login ulang, tanpa perlu campur tangan admin.
const COLLECTIONS_NEEDING_SCHOOL_ID = [
  'users',
  'students',
  'classes',
  'incidents',
  'attendance',
  'assessmentConfigs',
  'assessments',
  'dailyGrades',
  'curriculumFramework',
  'atp',
];

/**
 * MIGRASI SATU KALI (Fondasi Multi-Sekolah) — jalankan lewat tombol admin khusus,
 * SEKALI aja, SETELAH semua fungsi CREATE di service lain udah distempel
 * `schoolId: PILOT_SCHOOL_ID` (lihat constants/school.ts).
 *
 * Idempotent: dokumen yang UDAH punya field `schoolId` (apapun isinya) di-skip,
 * gak ditimpa. Jadi aman dipencet berkali-kali kalau ada collection yang gagal
 * di percobaan sebelumnya (misal karena rules/network), tinggal jalanin ulang.
 *
 * Batching di-chunk per 400 operasi (di bawah limit 500 per batch Firestore)
 * biar aman kalau suatu saat volume data per collection udah lumayan besar.
 */
export const backfillSchoolIdOnExistingData = async (): Promise<BackfillSchoolIdResult> => {
  const perCollection: Record<string, number> = {};
  let totalStamped = 0;

  for (const collectionName of COLLECTIONS_NEEDING_SCHOOL_ID) {
    const snapshot = await getDocs(collection(db, collectionName));
    const docsNeedingStamp = snapshot.docs.filter((d) => !d.data().schoolId);

    let stampedInThisCollection = 0;
    const CHUNK_SIZE = 400;

    for (let i = 0; i < docsNeedingStamp.length; i += CHUNK_SIZE) {
      const chunk = docsNeedingStamp.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((docSnap) => {
        batch.update(docSnap.ref, { schoolId: PILOT_SCHOOL_ID });
      });
      await batch.commit();
      stampedInThisCollection += chunk.length;
    }

    perCollection[collectionName] = stampedInThisCollection;
    totalStamped += stampedInThisCollection;
  }

  return { perCollection, totalStamped };
};

export interface MigrationDefaults {
  /** Educationlevel default untuk kelas yang baru dibuat dari migrasi. */
  defaultEducationLevel: EducationLevel;
  /** Tahun ajaran default untuk kelas yang baru dibuat dari migrasi. */
  defaultAcademicYear: string;
}

export interface MigrationResult {
  classesCreated: number;
  classesAlreadyExisted: number;
  studentsUpdated: number;
  teachersUpdated: number;
  unmatchedClassNames: string[]; // Nama kelas di teacher.classes yg gak ketemu siswa manapun
}

const CLASSES_COLLECTION = 'classes';
const STUDENTS_COLLECTION = 'students';
const USERS_COLLECTION = 'users';

export const migrateClassNamesToClasses = async (
  defaults: MigrationDefaults = { defaultEducationLevel: 'TK', defaultAcademicYear: '2026/2027' }
): Promise<MigrationResult> => {
  const result: MigrationResult = {
    classesCreated: 0,
    classesAlreadyExisted: 0,
    studentsUpdated: 0,
    teachersUpdated: 0,
    unmatchedClassNames: [],
  };

  // 1. Ambil semua kelas yang SUDAH ada di collection baru (biar idempotent —
  //    gak bikin dobel kalau migrasi ini kepencet dua kali)
  const existingClassesSnap = await getDocs(collection(db, CLASSES_COLLECTION));
  const nameToClassId = new Map<string, string>();
  existingClassesSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (typeof data.name === 'string') {
      nameToClassId.set(data.name, docSnap.id);
    }
  });

  // 2. Kumpulkan semua nama kelas unik dari Student.className DAN User.classes (guru)
  const studentsSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
  const usersSnap = await getDocs(collection(db, USERS_COLLECTION));

  const allClassNames = new Set<string>();
  studentsSnap.forEach((docSnap) => {
    const className = docSnap.data().className;
    if (typeof className === 'string' && className.trim()) {
      allClassNames.add(className.trim());
    }
  });
  usersSnap.forEach((docSnap) => {
    const classesArr = docSnap.data().classes;
    if (Array.isArray(classesArr)) {
      classesArr.forEach((c) => {
        if (typeof c === 'string' && c.trim()) {
          allClassNames.add(c.trim());
        }
      });
    }
  });

  // 3. Bikin dokumen `classes` baru untuk nama yang belum ada mapping-nya
  const createBatch = writeBatch(db);
  let pendingCreateCount = 0;

  allClassNames.forEach((name) => {
    if (nameToClassId.has(name)) {
      result.classesAlreadyExisted += 1;
      return;
    }
    const newClassRef = doc(collection(db, CLASSES_COLLECTION));
    createBatch.set(newClassRef, {
      name,
      educationLevel: defaults.defaultEducationLevel,
      academicYear: defaults.defaultAcademicYear,
      // Fondasi multi-sekolah — lihat constants/school.ts
      schoolId: PILOT_SCHOOL_ID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    nameToClassId.set(name, newClassRef.id);
    pendingCreateCount += 1;
  });

  if (pendingCreateCount > 0) {
    await createBatch.commit();
    result.classesCreated = pendingCreateCount;
  }

  // 4. Backfill `classId` di setiap dokumen Student (TANPA menghapus `className` lama)
  const studentBatch = writeBatch(db);
  let studentUpdateCount = 0;

  studentsSnap.forEach((docSnap) => {
    const className = docSnap.data().className;
    if (typeof className === 'string' && className.trim() && nameToClassId.has(className.trim())) {
      studentBatch.update(docSnap.ref, { classId: nameToClassId.get(className.trim()) });
      studentUpdateCount += 1;
    }
  });

  if (studentUpdateCount > 0) {
    await studentBatch.commit();
    result.studentsUpdated = studentUpdateCount;
  }

  // 5. Backfill `classIds` di setiap dokumen User guru (TANPA menghapus `classes` lama)
  const teacherBatch = writeBatch(db);
  let teacherUpdateCount = 0;

  usersSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.role !== 'teacher' || !Array.isArray(data.classes)) return;

    const mappedIds: string[] = [];
    (data.classes as string[]).forEach((name) => {
      const trimmed = typeof name === 'string' ? name.trim() : '';
      if (trimmed && nameToClassId.has(trimmed)) {
        mappedIds.push(nameToClassId.get(trimmed) as string);
      } else if (trimmed) {
        result.unmatchedClassNames.push(trimmed);
      }
    });

    if (mappedIds.length > 0) {
      teacherBatch.update(docSnap.ref, { classIds: mappedIds });
      teacherUpdateCount += 1;
    }
  });

  if (teacherUpdateCount > 0) {
    await teacherBatch.commit();
    result.teachersUpdated = teacherUpdateCount;
  }

  return result;
};
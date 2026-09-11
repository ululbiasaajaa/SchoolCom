import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DailyGrade } from '../types/schoolcom';

const DAILY_GRADES_COLLECTION = 'dailyGrades';

export type DailyGradeInput = Omit<DailyGrade, 'id' | 'createdAt'>;

/**
 * CATATAN PENTING soal `domainId`:
 * Di types (Phase 22), `DailyGrade.domainId` didokumentasikan sebagai reference ke
 * `CurriculumFramework.id` (CP). Tapi karena UI pemilihan CP/ATP belum dibangun
 * (baru masuk Phase 25), untuk SEKARANG field ini diisi dengan nilai yang SAMA
 * dengan `AssessmentSubjectConfig.id` / `StudentAssessment.subjectId` yang sudah
 * dipakai di alur nilai rapor existing (`assessmentConfigs` & `assessments`).
 * Ini supaya nilai harian bisa langsung nempel ke konteks mapel yang sedang guru
 * kerjakan sekarang di TeacherAssessmentView, tanpa nunggu CP/ATP selesai dulu.
 * Begitu Phase 25 selesai dan CP/ATP jadi sumber utama daftar mapel, cukup ganti
 * ID apa yang dikirim ke fungsi-fungsi di bawah — bentuk datanya tetap sama.
 */

/**
 * Realtime listener SEMUA nilai harian 1 siswa untuk 1 periode, LINTAS MAPEL
 * (beda dengan subscribeToDailyGradesByStudentDomain yang cuma 1 mapel).
 * Dipakai di ParentDashboardView (Phase 24) buat nampilin transparansi nilai
 * harian ke ortu — nanti dikelompokkan per mapel di sisi UI.
 */
export const subscribeToDailyGradesByStudent = (
  studentId: string,
  academicYear: string,
  term: string,
  callback: (grades: DailyGrade[]) => void
) => {
  const q = query(
    collection(db, DAILY_GRADES_COLLECTION),
    where('studentId', '==', studentId),
    where('academicYear', '==', academicYear),
    where('term', '==', term)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const grades = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<DailyGrade, 'id'>),
      }));
      grades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      callback(grades);
    },
    (error: unknown) => {
      console.error('Error subscribing to student daily grades:', error);
      callback([]);
    }
  );
};

/**
 * Realtime listener nilai harian 1 siswa untuk 1 domain (mapel/aspek) tertentu,
 * dalam 1 periode akademik. Ini yang dipakai TeacherAssessmentView buat nunjukin
 * histori nilai harian & saran rata-rata sebelum guru ngisi nilai rapor akhir.
 */
export const subscribeToDailyGradesByStudentDomain = (
  studentId: string,
  domainId: string,
  academicYear: string,
  term: string,
  callback: (grades: DailyGrade[]) => void
) => {
  const q = query(
    collection(db, DAILY_GRADES_COLLECTION),
    where('studentId', '==', studentId),
    where('domainId', '==', domainId),
    where('academicYear', '==', academicYear),
    where('term', '==', term)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const grades = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<DailyGrade, 'id'>),
      }));
      // Sort di client (bukan orderBy di query) supaya gak perlu bikin composite index
      // tambahan cuma buat ini — volume data per siswa+mapel+semester kecil (puluhan entri).
      grades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      callback(grades);
    },
    (error: unknown) => {
      console.error('Error subscribing to daily grades:', error);
      callback([]);
    }
  );
};

/**
 * Realtime listener SEMUA nilai harian dalam 1 kelas untuk 1 periode.
 * Belum ada UI yang makai ini di Phase 23 — disiapkan buat rekap kelas
 * di Phase 24 (Transparansi Nilai) / Phase 25 (Reporting).
 */
export const subscribeToDailyGradesByClass = (
  classId: string,
  academicYear: string,
  term: string,
  callback: (grades: DailyGrade[]) => void
) => {
  const q = query(
    collection(db, DAILY_GRADES_COLLECTION),
    where('classId', '==', classId),
    where('academicYear', '==', academicYear),
    where('term', '==', term)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const grades = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<DailyGrade, 'id'>),
      }));
      callback(grades);
    },
    (error: unknown) => {
      console.error('Error subscribing to class daily grades:', error);
      callback([]);
    }
  );
};

/**
 * Tambah entri nilai harian baru.
 */
export const addDailyGrade = async (input: DailyGradeInput): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, DAILY_GRADES_COLLECTION), {
      ...input,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error: unknown) {
    console.error('Error adding daily grade:', error);
    throw error;
  }
};

/**
 * Update entri nilai harian (misal guru salah input, mau koreksi skor/catatan).
 * `classId`, `studentId`, `domainId` sengaja TIDAK bisa diubah lewat fungsi ini
 * (konsisten sama rules dailyGrades yang mengunci field identitas saat update) —
 * kalau salah pilih siswa/mapel, hapus & buat entri baru.
 */
export const updateDailyGrade = async (
  gradeId: string,
  data: Partial<Pick<DailyGrade, 'score' | 'type' | 'notes' | 'date'>>
): Promise<void> => {
  try {
    const ref = doc(db, DAILY_GRADES_COLLECTION, gradeId);
    await updateDoc(ref, data);
  } catch (error: unknown) {
    console.error('Error updating daily grade:', error);
    throw error;
  }
};

/**
 * Hapus entri nilai harian.
 */
export const deleteDailyGrade = async (gradeId: string): Promise<void> => {
  try {
    const ref = doc(db, DAILY_GRADES_COLLECTION, gradeId);
    await deleteDoc(ref);
  } catch (error: unknown) {
    console.error('Error deleting daily grade:', error);
    throw error;
  }
};

/**
 * EVT-06: Tandai sekumpulan entri nilai harian sebagai "sudah dinotifikasi".
 * Dipanggil SETELAH notifyParentOnDailyGrades berhasil terkirim — guru me-review
 * beberapa entri dulu (bisa lintas tanggal/jenis), baru kirim notifikasi manual
 * sekali klik, ini yang nyatet biar entri yang sama gak ke-notif dobel di sesi
 * berikutnya.
 */
export const markDailyGradesAsNotified = async (gradeIds: string[]): Promise<void> => {
  if (gradeIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    gradeIds.forEach((id) => {
      batch.update(doc(db, DAILY_GRADES_COLLECTION, id), { notifiedAt: now });
    });
    await batch.commit();
  } catch (error: unknown) {
    console.error('Error marking daily grades as notified:', error);
    throw error;
  }
};

/**
 * Hitung rata-rata nilai harian — dipakai sebagai SARAN nilai rapor di
 * TeacherAssessmentView. Guru tetap bebas override manual, ini cuma bantuan awal
 * biar guru gak perlu ngitung manual dari tumpukan nilai kuis/tugas.
 */
export const calculateSuggestedScore = (grades: DailyGrade[]): number | null => {
  if (!grades || grades.length === 0) return null;

  const validScores = grades
    .map((g) => g.score)
    .filter((s): s is number => typeof s === 'number' && !isNaN(s));

  if (validScores.length === 0) return null;

  const total = validScores.reduce((sum, s) => sum + s, 0);
  return parseFloat((total / validScores.length).toFixed(1));
};
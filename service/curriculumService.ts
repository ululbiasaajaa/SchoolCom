import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ATP, CurriculumFramework, EducationLevel, TujuanPembelajaran } from '../types/schoolcom';

const CURRICULUM_COLLECTION = 'curriculumFramework';
const ATP_COLLECTION = 'atp';

export type CurriculumFrameworkInput = Omit<CurriculumFramework, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Realtime listener CP berdasarkan jenjang tertentu (buat form config per jenjang di Phase 26).
 */
export const subscribeToCurriculumByLevel = (
  educationLevel: EducationLevel,
  callback: (items: CurriculumFramework[]) => void
) => {
  const q = query(
    collection(db, CURRICULUM_COLLECTION),
    where('educationLevel', '==', educationLevel),
    orderBy('domainName', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<CurriculumFramework, 'id'>),
      }));
      callback(items);
    },
    (error: unknown) => {
      console.error(`Error subscribing to curriculum for level ${educationLevel}:`, error);
      callback([]);
    }
  );
};

/**
 * Realtime listener SEMUA entri CP lintas jenjang.
 *
 * CATATAN: `assessmentConfigs` (config nilai per periode) saat ini BELUM di-scope
 * per kelas/jenjang — satu config berlaku untuk semua kelas di periode itu (karena
 * sekolah pilot masih TK semua). Jadi picker "tautkan ke CP" di admin butuh melihat
 * SEMUA entri CP, bukan cuma 1 jenjang. Setelah Phase 26 (feature gating per jenjang)
 * membuat config benar-benar per-kelas, ganti pemanggilnya ke
 * `subscribeToCurriculumByLevel` yang sudah ada di atas.
 */
export const subscribeToAllCurriculum = (callback: (items: CurriculumFramework[]) => void) => {
  const q = query(collection(db, CURRICULUM_COLLECTION), orderBy('domainName', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<CurriculumFramework, 'id'>),
      }));
      callback(items);
    },
    (error: unknown) => {
      console.error('Error subscribing to all curriculum:', error);
      callback([]);
    }
  );
};

/**
 * Tambah entri CP baru (Admin Only)
 */
export const createCurriculumFramework = async (data: CurriculumFrameworkInput): Promise<string> => {
  const newRef = doc(collection(db, CURRICULUM_COLLECTION));
  await setDoc(newRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return newRef.id;
};

/**
 * Update entri CP (Admin Only)
 */
export const updateCurriculumFramework = async (
  id: string,
  data: Partial<CurriculumFrameworkInput>
): Promise<void> => {
  const ref = doc(db, CURRICULUM_COLLECTION, id);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

/**
 * Hapus entri CP (Admin Only).
 * CATATAN: sama seperti deleteClass, ini TIDAK cascade ke ATP atau dailyGrades
 * yang mungkin masih mereferensikan cpId ini. Cek dulu di UI sebelum hapus.
 */
export const deleteCurriculumFramework = async (id: string): Promise<void> => {
  const ref = doc(db, CURRICULUM_COLLECTION, id);
  await deleteDoc(ref);
  // ATP terkait dibiarkan (bukan dihapus otomatis) supaya data historis ATP-nya
  // gak hilang kalau CP-nya ke-delete gak sengaja lalu dibuat ulang.
};

/**
 * Ambil ATP untuk satu CP tertentu.
 * Relasi CP:ATP itu 1:1, jadi doc ID ATP SAMA DENGAN cpId — supaya gampang
 * di-lookup langsung tanpa query (`doc(db, 'atp', cpId)` bukan where('cpId', '==', ...)).
 */
export const getATPByCP = async (cpId: string): Promise<ATP | null> => {
  const ref = doc(db, ATP_COLLECTION, cpId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ATP, 'id'>) };
};

/**
 * Realtime listener ATP untuk satu CP tertentu.
 */
export const subscribeToATP = (cpId: string, callback: (atp: ATP | null) => void) => {
  const ref = doc(db, ATP_COLLECTION, cpId);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback({ id: snap.id, ...(snap.data() as Omit<ATP, 'id'>) });
    },
    (error: unknown) => {
      console.error(`Error subscribing to ATP for CP ${cpId}:`, error);
      callback(null);
    }
  );
};

/**
 * Simpan (create atau overwrite) daftar Tujuan Pembelajaran untuk satu CP.
 * Karena doc ID = cpId, `setDoc` di sini otomatis upsert.
 */
export const saveATP = async (cpId: string, tpList: TujuanPembelajaran[]): Promise<void> => {
  const ref = doc(db, ATP_COLLECTION, cpId);
  await setDoc(
    ref,
    {
      cpId,
      tpList,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
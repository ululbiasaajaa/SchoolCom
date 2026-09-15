import * as Crypto from 'expo-crypto';
import {
    collection,
    doc,
    getDocs,
    query,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { PILOT_SCHOOL_ID } from '../constants/school';

export interface ReportLink {
  token: string;
  studentId: string;
  studentName: string;
  academicYear: string;
  term: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  revokedAt?: string | null;
  schoolId: string;
}

/**
 * REV-03: Generate token aman secara kriptografis (32 byte random = 64 karakter
 * hex). SENGAJA BUKAN studentId atau ID yang bisa ditebak — token ini
 * diperlakukan sebagai CREDENTIAL (siapapun yang punya string ini bisa buka
 * rapor), bukan sekadar pengenal record. Makin panjang & random, makin gak
 * mungkin ditebak/di-brute-force.
 */
const generateSecureToken = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Cari link yang MASIH AKTIF untuk siswa+periode tertentu. Dipakai supaya
 * "Buat Link Rapor" gak bikin token baru tiap kali dipencet — sesuai
 * keputusan: token persisten, gak berubah walau guru revisi nilai berkali-kali.
 */
export const getActiveReportLink = async (
  studentId: string,
  academicYear: string,
  term: string
): Promise<ReportLink | null> => {
  try {
    const q = query(
      collection(db, 'reportLinks'),
      where('studentId', '==', studentId),
      where('academicYear', '==', academicYear),
      where('term', '==', term),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as ReportLink;
  } catch (error: unknown) {
    console.error('Error fetching active report link:', error);
    throw error;
  }
};

/**
 * Bikin token BARU (dipakai baik untuk generate pertama kali maupun untuk
 * "Regenerate" setelah link lama di-revoke). Document ID Firestore SENGAJA
 * dibuat = token itu sendiri (bukan auto-ID), supaya endpoint publik nanti
 * bisa langsung `doc(db,'reportLinks', token).get()` tanpa perlu query.
 */
export const createReportLink = async (
  studentId: string,
  studentName: string,
  academicYear: string,
  term: string,
  createdBy: string
): Promise<ReportLink> => {
  try {
    const token = await generateSecureToken();
    const record: ReportLink = {
      token,
      studentId,
      studentName,
      academicYear,
      term,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy,
      revokedAt: null,
      schoolId: PILOT_SCHOOL_ID,
    };
    await setDoc(doc(db, 'reportLinks', token), record);
    return record;
  } catch (error: unknown) {
    console.error('Error creating report link:', error);
    throw error;
  }
};

/**
 * Get-or-create: dipanggil dari tombol "Buat Link Rapor". Kalau udah ada yang
 * aktif, kembalikan itu (link lama tetap valid). Kalau belum ada / udah
 * di-revoke, bikin baru.
 */
export const getOrCreateReportLink = async (
  studentId: string,
  studentName: string,
  academicYear: string,
  term: string,
  createdBy: string
): Promise<ReportLink> => {
  const existing = await getActiveReportLink(studentId, academicYear, term);
  if (existing) return existing;
  return createReportLink(studentId, studentName, academicYear, term, createdBy);
};

/**
 * Cabut akses. SENGAJA PERMANEN — token yang di-revoke gak bisa
 * diaktifkan lagi (bukan toggle on/off), karena begitu ortu tau linknya
 * pernah "mati", mereka gak akan percaya lagi kalau tiba-tiba "hidup"
 * sendiri. Kalau butuh akses baru setelah revoke, guru bikin link baru
 * (createReportLink), bukan reaktivasi yang lama.
 */
export const revokeReportLink = async (token: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'reportLinks', token), {
      isActive: false,
      revokedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error revoking report link:', error);
    throw error;
  }
};
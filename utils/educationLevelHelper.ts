import { EducationLevel, SchoolClass } from '../types/schoolcom';

/**
 * PHASE 26 — EDUCATION-LEVEL FEATURE GATING (Architecture Validation)
 *
 * Ini SATU-SATUNYA tempat yang nentuin jenjang mana yang modul assessment-nya
 * udah siap dipakai. Komponen (TeacherAssessmentView, AdminAssessmentConfigModal,
 * ParentDashboardView) TIDAK BOLEH punya logic `if (level === 'TK') ... else if (...)`
 * sendiri-sendiri — semua manggil helper di file ini. Nambah dukungan jenjang baru
 * nanti (misal SD) cukup ubah 1 baris `ASSESSMENT_MODE_READY` di bawah, gak perlu
 * bongkar kode di 3 tempat berbeda.
 */

// Toggle pusat: true = modul assessment jenjang ini udah dibangun & aman dipakai.
// SD/SMP/SMA masih false karena Phase 26 ini scope-nya "architecture validation",
// bukan "feature expansion" — bentuk form buat jenjang itu belum didesain.
export const ASSESSMENT_MODE_READY: Record<EducationLevel, boolean> = {
  TK: true,
  SD: false,
  SMP: false,
  SMA: false,
};

export const isAssessmentModeReady = (level: EducationLevel | null | undefined): boolean => {
  if (!level) return true; // Fallback aman: data lama/pra-migrasi tanpa classId dianggap TK (lihat resolveEducationLevel)
  return ASSESSMENT_MODE_READY[level] ?? false;
};

// Label domain penilaian per jenjang — dipakai biar teks UI konsisten di semua
// komponen (TK pakai istilah "Aspek Perkembangan", bukan "Mata Pelajaran").
export const ASSESSMENT_DOMAIN_LABEL: Record<EducationLevel, string> = {
  TK: 'Aspek Perkembangan',
  SD: 'Mata Pelajaran',
  SMP: 'Mata Pelajaran',
  SMA: 'Mata Pelajaran',
};

export const getAssessmentDomainLabel = (level: EducationLevel | null | undefined): string => {
  if (!level) return ASSESSMENT_DOMAIN_LABEL.TK;
  return ASSESSMENT_DOMAIN_LABEL[level] ?? 'Mata Pelajaran';
};

/**
 * Pesan "coming soon" seragam — dipakai di ketiga komponen supaya bahasanya
 * konsisten (bukan masing-masing komponen ngarang teks sendiri).
 */
export const getComingSoonMessage = (level: EducationLevel): string =>
  `Fitur penilaian untuk jenjang ${level} akan segera hadir. Saat ini modul penilaian baru mendukung jenjang TK.`;

/**
 * Resolve educationLevel dari classId siswa, dengan fallback aman ke 'TK'.
 *
 * FALLBACK PENTING: kalau classId kosong (siswa belum termigrasi / data lama)
 * atau kelasnya gak ketemu di collection `classes`, fungsi ini balikin 'TK' —
 * BUKAN null. Ini disengaja supaya gating Phase 26 gak bikin regresi ke alur TK
 * yang udah lolos testing di Phase 22-25 kalau ada edge case data belum lengkap.
 * Gating cuma "menyala" untuk kasus yang EKSPLISIT diketahui SD/SMP/SMA.
 */
export const resolveEducationLevel = (
  classId: string | undefined,
  classes: SchoolClass[]
): EducationLevel => {
  if (!classId) return 'TK';
  const found = classes.find((c) => c.id === classId);
  return found?.educationLevel || 'TK';
};
// ==========================================
// TAMBAHKAN INTERFACE-INTERFACE BERIKUT KE types/schoolcom.ts
// (Phase 22 — V2 Academic System & V3 Adaptive Education Foundation)
// ==========================================

/**
 * Jenjang pendidikan yang didukung SchoolCom.
 * Dipakai untuk feature-gating adaptif (V3) DAN untuk menentukan struktur
 * CP/ATP yang benar (TK pakai "aspek perkembangan", SD ke atas pakai "mata pelajaran").
 */
export type EducationLevel = 'TK' | 'SD' | 'SMP' | 'SMA';

/**
 * Entity Kelas — sebelumnya cuma field string bebas (`className`) yang di-copy
 * ke Student & User. Sekarang jadi collection sendiri supaya:
 * - Bisa nyimpen educationLevel per kelas (fondasi V3)
 * - Satu kelas gak perlu diketik ulang manual di banyak tempat (single source of truth)
 * - Gampang query "semua kelas jenjang TK" dsb ke depannya
 */
export interface SchoolClass {
  id: string;
  name: string; // Tetap format "Kelas TK-A" biar konsisten sama tampilan lama
  educationLevel: EducationLevel;
  academicYear: string; // "2026/2027"
  homeroomTeacherId?: string; // uid guru wali kelas (opsional, bisa diisi belakangan)
  createdAt: string;
  updatedAt: string;
}

/**
 * Tipe domain penilaian — beda istilah tergantung jenjang:
 * - TK/PAUD: "aspek_perkembangan" (Nilai Agama & Budi Pekerti, Fisik-Motorik, dst — SESUAI
 *   Kurikulum Merdeka PAUD, BUKAN mata pelajaran)
 * - SD/SMP/SMA: "mata_pelajaran" (Matematika, B. Indonesia, dst)
 *
 * Field ini generic dari awal supaya model data gak perlu dibongkar ulang
 * pas nanti nambah jenjang SD/SMP/SMA — cuma nambah data baru dengan domainType berbeda.
 */
export type CurriculumDomainType = 'aspek_perkembangan' | 'mata_pelajaran';

/**
 * CP (Capaian Pembelajaran) — deskripsi capaian per fase & domain,
 * sesuai struktur resmi Kurikulum Merdeka.
 */
export interface CurriculumFramework {
  id: string;
  educationLevel: EducationLevel;
  fase: string; // "Fase Fondasi" (TK), "Fase A/B" (SD), "Fase C" (SMP), "Fase D/E/F" (SMA)
  domainType: CurriculumDomainType;
  domainName: string; // "Nilai Agama dan Budi Pekerti" (TK) / "Matematika" (SD+)
  cpDescription: string; // Narasi capaian pembelajaran
  createdAt: string;
  updatedAt: string;
}

/**
 * Satu Tujuan Pembelajaran (TP) di dalam sebuah ATP.
 */
export interface TujuanPembelajaran {
  id: string;
  description: string;
  order: number; // Urutan tampil, bukan urutan array (biar aman kalau di-reorder)
}

/**
 * ATP (Alur Tujuan Pembelajaran) — breakdown CP menjadi langkah-langkah
 * pembelajaran yang lebih konkret & berurutan.
 */
export interface ATP {
  id: string;
  cpId: string; // Reference ke CurriculumFramework.id
  tpList: TujuanPembelajaran[];
  updatedAt: string;
}

/**
 * Nilai Harian (Formative Assessment) — Phase 23.
 * Beda dengan StudentAssessment (nilai rapor akhir semester, 1 record per
 * siswa+mapel+semester): dailyGrades bisa banyak record per semester,
 * satu per aktivitas/kuis/tugas.
 */
export type DailyGradeType = 'Kuis' | 'Tugas' | 'Ulangan' | 'Praktik' | 'Observasi';

export interface DailyGrade {
  id: string;
  studentId: string;
  classId: string;
  domainId: string; // Reference ke CurriculumFramework.id (aspek/mapel terkait)
  tpId?: string; // Opsional: reference ke TujuanPembelajaran spesifik yang dinilai
  academicYear: string;
  term: string;
  date: string;
  score: number;
  type: DailyGradeType;
  notes?: string;
  teacherName: string;
  createdAt: string;
}
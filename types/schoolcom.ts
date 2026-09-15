export type UserRole = 'admin' | 'teacher' | 'parent';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentIds?: string[]; // Properti opsional khusus untuk role 'parent'
  classes?: string[];    // Properti opsional khusus untuk role 'teacher'
  classIds?: string[];   // FIX Phase 22: hasil migrasi dari `classes` (string[]) -> reference ke collection `classes`
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  // Sekarang selalu bernilai PILOT_SCHOOL_ID untuk semua user.
  schoolId?: string;
}

export type CategoryType = 'Observation' | 'Behavior' | 'Academic' | 'Social' | 'Incident' | 'Health' | 'Other';
export type PriorityType = 'Low' | 'Medium' | 'High' | 'Critical';
export type StatusType = 'Pending' | 'Follow-up' | 'Resolved';

export interface Parent {
  name: string;
  relationship: string;
  phone: string;
}

export interface Student {
  id: string;
  name: string;
  avatar: string;
  gender?: 'M' | 'F';
  className: string;
  classId?: string; // Phase 22: hasil migrasi, reference ke collection `classes`. className TETAP dipertahankan untuk backward-compat.
  dob: string;
  parents: Parent[];
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  schoolId?: string;
}


export interface FollowUpLog {
  id: string;
  note: string;
  author?: string;
  date?: string;
  createdAt?: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  studentId: string;
  studentName?: string; // Optional di model utama untuk backward-compatibility dokumen lama
  className?: string;   // Optional di model utama untuk backward-compatibility dokumen lama
  date?: string;        // Format YYYY-MM-DD tanggal kejadian
  category: CategoryType;
  priority: PriorityType;
  description: string;
  actionTaken?: string; // Kembali dijadikan optional
  status: StatusType;
  createdAt: string;
  updatedAt?: string;
  teacherName: string;
  followUpLogs: FollowUpLog[];
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  schoolId?: string;
}

// Strictly Typed Input Payload untuk Pembuatan Incident Baru
export interface NewIncidentInput {
  studentId: string;
  studentName: string;  // WAJIB diisi saat buat baru
  className: string;    // WAJIB diisi saat buat baru agar lolos Firestore Rules
  date?: string;        // YYYY-MM-DD
  category: CategoryType;
  priority: PriorityType;
  description: string;
  actionTaken?: string;
  status?: StatusType;  // Default: 'Pending'
  teacherName: string;
}

// ==========================================
// FLEXIBLE ASSESSMENT MODULE TYPES
// ==========================================

export interface AssessmentPredicateConfig {
  id: string;
  label: string;
}

export interface AssessmentSubjectFieldsConfig {
  enableNumeric: boolean;
  enablePredicate: boolean;
  enableNarrative: boolean;
}

export interface AssessmentSubjectConfig {
  id: string;
  name: string;
  category: string;
  fields: AssessmentSubjectFieldsConfig;
  // Phase 25: link opsional ke CurriculumFramework (CP). `cpDescription` sengaja
  // disalin langsung ke sini (denormalized) — pola yang sama dengan StudentAssessment
  // yang nyimpen studentName/subjectName langsung, bukan cuma ID — supaya pdfGenerator.ts
  // gak perlu fetch tambahan ke Firestore pas generate rapor, cukup baca dari config yang
  // sudah di-load. `cpId` tetap disimpan buat keperluan re-link/re-edit di admin.
  cpId?: string;
  cpDescription?: string;
}

export interface AssessmentConfig {
  id: string;
  academicYear: string;
  term: string;
  predicates: AssessmentPredicateConfig[];
  subjects: AssessmentSubjectConfig[];
  updatedAt: string;
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  // Config masih GLOBAL per periode (bukan per sekolah) sampai ada Sekolah B beneran.
  schoolId?: string;
}

export interface StudentAssessment {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  academicYear: string;
  term: string;
  subjectId: string;
  subjectName: string;
  score?: number | null;
  predicate?: string | null;
  narrative?: string | null;
  teacherName: string;
  createdAt: string;
  updatedAt: string;
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  schoolId?: string;
  notifiedAt?: string | null;
}

// ==========================================
// BROADCAST ANNOUNCEMENT MODULE TYPES
// ==========================================

export type BroadcastTargetRole = 'all' | 'parent' | 'teacher';

export interface BroadcastAnnouncement {
  id?: string;
  title: string;
  message: string;
  targetRole: BroadcastTargetRole;
  createdByName: string;
  createdAt: string;
}

// ==========================================
// V2 ACADEMIC SYSTEM & V3 ADAPTIVE EDUCATION TYPES (Phase 22+)
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
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  schoolId?: string;
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
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  schoolId?: string;
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
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  schoolId?: string;
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
  // EVT-06: kapan entri ini terakhir diikutkan dalam notifikasi ke ortu.
  // undefined = belum pernah dinotifikasi sama sekali. Guru me-review dulu
  // beberapa entri, baru kirim notifikasi manual sekali klik (bukan per-entri),
  // supaya ortu gak kebanjiran push notification tiap kali 1 nilai diinput.
  notifiedAt?: string;
  // Fondasi multi-sekolah (belum aktif sebagai fitur) — lihat constants/school.ts.
  schoolId?: string;
}
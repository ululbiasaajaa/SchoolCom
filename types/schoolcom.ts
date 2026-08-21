export type UserRole = 'admin' | 'teacher' | 'parent';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentIds?: string[]; // Properti opsional khusus untuk role 'parent'
  classes?: string[];    // Properti opsional khusus untuk role 'teacher'
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
  dob: string;
  parents: Parent[];
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
}

export interface AssessmentConfig {
  id: string;
  academicYear: string;
  term: string;
  predicates: AssessmentPredicateConfig[];
  subjects: AssessmentSubjectConfig[];
  updatedAt: string;
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
}
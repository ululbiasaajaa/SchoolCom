import { StudentAssessment } from '../types/schoolcom';

/**
 * Interface ringkasan penilaian per periode akademik.
 */
export interface AssessmentPeriodSummary {
  periodKey: string;
  academicYear: string;
  term: string;
  assessments: StudentAssessment[];
  totalSubjectsCount: number;
  numericScoresCount: number;
  averageScore: number | null;
}

/**
 * Memfilter daftar penilaian berdasarkan ID siswa secara Immutabel.
 */
export const filterAssessmentsByStudent = (
  assessments: StudentAssessment[],
  studentId: string
): StudentAssessment[] => {
  if (!assessments || !Array.isArray(assessments) || !studentId) {
    return [];
  }
  return assessments.filter((a) => a.studentId === studentId);
};

/**
 * Helper internal untuk membandingkan urutan periode (Tahun Ajaran & Semester) secara Descending.
 */
export const sortAssessmentPeriods = (
  periods: AssessmentPeriodSummary[]
): AssessmentPeriodSummary[] => {
  return [...periods].sort((a, b) => {
    // 1. Bandingkan Tahun Ajaran (Desc)
    if (a.academicYear !== b.academicYear) {
      return b.academicYear.localeCompare(a.academicYear);
    }
    // 2. Bandingkan Semester (Desc)
    return b.term.localeCompare(a.term);
  });
};

/**
 * Mengelompokkan array StudentAssessment[] berdasarkan kombinasi Periode (academicYear + term).
 * Menghitung ringkasan statistik (jumlah subjek, rata-rata nilai numerik) secara Immutabel.
 */
export const groupAssessmentsByPeriod = (
  assessments: StudentAssessment[]
): AssessmentPeriodSummary[] => {
  if (!assessments || !Array.isArray(assessments) || assessments.length === 0) {
    return [];
  }

  // Gunakan Map untuk mengelompokkan record tanpa mutasi
  const periodMap = new Map<string, StudentAssessment[]>();

  assessments.forEach((item) => {
    if (!item || !item.academicYear || !item.term) return;

    const key = `${item.academicYear}_${item.term}`;
    const existingGroup = periodMap.get(key);

    if (existingGroup) {
      existingGroup.push(item);
    } else {
      periodMap.set(key, [item]);
    }
  });

  const summaryList: AssessmentPeriodSummary[] = [];

  periodMap.forEach((groupItems, key) => {
    const firstItem = groupItems[0];
    const academicYear = firstItem.academicYear;
    const term = firstItem.term;

    let totalScoreSum = 0;
    let numericCount = 0;

    groupItems.forEach((item) => {
      if (
        item.score !== null &&
        item.score !== undefined &&
        typeof item.score === 'number' &&
        !isNaN(item.score)
      ) {
        totalScoreSum += item.score;
        numericCount += 1;
      }
    });

    const averageScore = numericCount > 0 ? parseFloat((totalScoreSum / numericCount).toFixed(2)) : null;

    summaryList.push({
      periodKey: key,
      academicYear,
      term,
      assessments: groupItems,
      totalSubjectsCount: groupItems.length,
      numericScoresCount: numericCount,
      averageScore,
    });
  });

  return sortAssessmentPeriods(summaryList);
};
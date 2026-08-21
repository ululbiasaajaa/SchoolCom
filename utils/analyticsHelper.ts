import { StudentAssessment } from '../types/schoolcom';
import { AssessmentPeriodSummary } from './historyHelper';

// 1. Tipe Data Contract Final
export type TrendDirection = 'up' | 'down' | 'stable' | 'initial';

export interface SubjectProgressionSummary {
  subjectId: string;
  subjectName: string;
  scoresHistory: { academicYear: string; term: string; score: number }[];
  latestScore: number | null;
  previousScore: number | null;
  deltaScore: number | null;
  trendDirection: TrendDirection;
}

export interface OverallProgressMetrics {
  latestAverage: number | null;
  previousAverage: number | null;
  deltaScore: number | null;
  trendDirection: TrendDirection;
  highestSubject: { subjectName: string; score: number } | null;
  lowestSubject: { subjectName: string; score: number } | null;
  totalPeriodsEvaluated: number;
}

/**
  Helper untuk mengonversi academicYear + term menjadi nilai skalar numerik.
 * Digunakan untuk pengurutan kronologis secara presisi.
 */
const getPeriodValue = (academicYear: string, term: string): number => {
  const startYear = parseInt(academicYear.split('/')[0], 10) || 0;
  const termNum = term.includes('2') ? 2 : 1;
  return startYear * 10 + termNum;
};

/**
  Atomic Pure Function untuk menghitung selisih matematis dan menentukan arah tren.
 */
export const calculatePeriodDelta = (
  currentScore: number | null,
  previousScore: number | null
): { deltaScore: number | null; trendDirection: TrendDirection } => {
  if (
    currentScore === null ||
    currentScore === undefined ||
    previousScore === null ||
    previousScore === undefined
  ) {
    return { deltaScore: null, trendDirection: 'initial' };
  }

  const deltaScore = currentScore - previousScore;

  let trendDirection: TrendDirection = 'stable';
  if (deltaScore > 0) {
    trendDirection = 'up';
  } else if (deltaScore < 0) {
    trendDirection = 'down';
  } else {
    trendDirection = 'stable';
  }

  return { deltaScore, trendDirection };
};

/**
  Pengelompokan Asesmen Berdasarkan Mata Pelajaran (Subject Progression).
 * Mengurutkan riwayat nilai secara kronologis ASCENDING (Terlama -> Terbaru)
 * sebelum mengambil latestScore dan previousScore.
 */
export const groupAssessmentsBySubject = (
  assessments: StudentAssessment[]
): SubjectProgressionSummary[] => {
  if (!assessments || !Array.isArray(assessments) || assessments.length === 0) {
    return [];
  }

  // 1. Grouping berdasarkan subjectId
  const subjectMap = new Map<string, StudentAssessment[]>();
  assessments.forEach((item) => {
    if (!item || !item.subjectId) return;
    const existing = subjectMap.get(item.subjectId) || [];
    existing.push(item);
    subjectMap.set(item.subjectId, existing);
  });

  const result: SubjectProgressionSummary[] = [];

  subjectMap.forEach((items, subjectId) => {
    const firstItem = items[0];
    const subjectName = firstItem.subjectName || 'Mata Pelajaran';

    // 2. Filter & Mapping ke objek skor valid
    const validScoresHistory = items
      .filter(
        (a) =>
          a.score !== null &&
          a.score !== undefined &&
          typeof a.score === 'number' &&
          !isNaN(a.score)
      )
      .map((a) => ({
        academicYear: a.academicYear,
        term: a.term,
        score: a.score as number,
      }))
      // 3. FIX BUG: Sort eksplisit ASCENDING (Terlama -> Terbaru)
      .sort((a, b) => {
        const valA = getPeriodValue(a.academicYear, a.term);
        const valB = getPeriodValue(b.academicYear, b.term);
        return valA - valB;
      });

    // Jika tidak ada skor numerik valid
    if (validScoresHistory.length === 0) {
      result.push({
        subjectId,
        subjectName,
        scoresHistory: [],
        latestScore: null,
        previousScore: null,
        deltaScore: null,
        trendDirection: 'initial',
      });
      return;
    }

    // 4. Ambil entry terbaru (elemen terakhir dari array yang sudah di-sort ASC)
    const latestEntry = validScoresHistory[validScoresHistory.length - 1];
    const latestScore = latestEntry.score;

    // 5. Ambil entry kronologis sebelumnya (jika ada)
    const previousEntry =
      validScoresHistory.length > 1
        ? validScoresHistory[validScoresHistory.length - 2]
        : null;
    const previousScore = previousEntry ? previousEntry.score : null;

    // 6. Hitung delta & trend menggunakan atomic helper
    const { deltaScore, trendDirection } = calculatePeriodDelta(
      latestScore,
      previousScore
    );

    result.push({
      subjectId,
      subjectName,
      scoresHistory: validScoresHistory,
      latestScore,
      previousScore,
      deltaScore,
      trendDirection,
    });
  });

  return result;
};

/**
  Mengekstrak Ringkasan Metrik PerformaKeseluruhan Siswa.
 * Memanfaatkan array AssessmentPeriodSummary (yang sudah di-sort DESCENDING oleh historyHelper).
 */
export const getStudentProgressMetrics = (
  periods: AssessmentPeriodSummary[]
): OverallProgressMetrics => {
  if (!periods || !Array.isArray(periods) || periods.length === 0) {
    return {
      latestAverage: null,
      previousAverage: null,
      deltaScore: null,
      trendDirection: 'initial',
      highestSubject: null,
      lowestSubject: null,
      totalPeriodsEvaluated: 0,
    };
  }

  // Karena periods di-sort DESCENDING (NEWEST -> OLDEST):
  // periods[0] = Periode Terbaru
  // periods[1] = Periode Sebelumnya
  const latestPeriod = periods[0];
  const previousPeriod = periods.length > 1 ? periods[1] : null;

  const latestAverage = latestPeriod.averageScore;
  const previousAverage = previousPeriod ? previousPeriod.averageScore : null;

  // Hitung delta & trend overall
  const { deltaScore, trendDirection } = calculatePeriodDelta(
    latestAverage,
    previousAverage
  );

  // Cari Highest & Lowest Subject HANYA dari Periode Terbaru (latestPeriod)
  let highestSubject: { subjectName: string; score: number } | null = null;
  let lowestSubject: { subjectName: string; score: number } | null = null;

  const validLatestAssessments = latestPeriod.assessments.filter(
    (a) =>
      a.score !== null &&
      a.score !== undefined &&
      typeof a.score === 'number' &&
      !isNaN(a.score)
  );

  if (validLatestAssessments.length > 0) {
    let maxItem = validLatestAssessments[0];
    let minItem = validLatestAssessments[0];

    validLatestAssessments.forEach((item) => {
      if ((item.score as number) > (maxItem.score as number)) {
        maxItem = item;
      }
      if ((item.score as number) < (minItem.score as number)) {
        minItem = item;
      }
    });

    highestSubject = {
      subjectName: maxItem.subjectName,
      score: maxItem.score as number,
    };

    lowestSubject = {
      subjectName: minItem.subjectName,
      score: minItem.score as number,
    };
  }

  return {
    latestAverage,
    previousAverage,
    deltaScore,
    trendDirection,
    highestSubject,
    lowestSubject,
    totalPeriodsEvaluated: periods.length,
  };
};
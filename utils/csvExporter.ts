import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { AssessmentConfig, Student, StudentAssessment } from '../types/schoolcom';

const sanitizeCSVValue = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val).replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${str}"`;
};

export const exportAssessmentsToCSV = async (
  students: Student[],
  config: AssessmentConfig,
  assessments: StudentAssessment[],
  defaultTeacherName: string = 'Guru'
): Promise<void> => {
  try {
    if (students.length === 0) {
      Alert.alert('Peringatan', 'Tidak ada data siswa untuk diekspor.');
      return;
    }

    const headers = [
      'Student_ID',
      'Student_Name',
      'Class_Name',
      'Academic_Year',
      'Term',
      'Subject_Category',
      'Subject_Name',
      'Score',
      'Predicate',
      'Narrative',
      'Teacher_Name',
      'Updated_At',
    ];

    const rows: string[] = [];
    rows.push(headers.map((h) => sanitizeCSVValue(h)).join(','));

    students.forEach((student) => {
      config.subjects.forEach((subject) => {
        const record = assessments.find(
          (a) =>
            a.studentId === student.id &&
            a.subjectId === subject.id &&
            a.academicYear === config.academicYear &&
            a.term === config.term
        );

        const rowData = [
          sanitizeCSVValue(student.id),
          sanitizeCSVValue(student.name),
          sanitizeCSVValue(student.className || '-'),
          sanitizeCSVValue(config.academicYear),
          sanitizeCSVValue(config.term),
          sanitizeCSVValue(subject.category || 'Umum'),
          sanitizeCSVValue(subject.name),
          sanitizeCSVValue(
            record?.score !== null && record?.score !== undefined ? record.score : ''
          ),
          sanitizeCSVValue(record?.predicate || ''),
          sanitizeCSVValue(record?.narrative || ''),
          sanitizeCSVValue(record?.teacherName || defaultTeacherName),
          sanitizeCSVValue(record?.updatedAt || ''),
        ];

        rows.push(rowData.join(','));
      });
    });

    const csvString = '\uFEFF' + rows.join('\n');

    // Guard: cacheDirectory can be null on some platforms/configs.
    // Surfacing this explicitly instead of letting writeAsStringAsync throw a vague error.
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      throw new Error('FileSystem.cacheDirectory tidak tersedia di perangkat ini.');
    }

    const fileName = `Rekap_Penilaian_${config.academicYear.replace(/\//g, '-')}_${config.term.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    const fileUri = `${cacheDir}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, csvString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Export CSV Penilaian (${config.academicYear} - ${config.term})`,
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('Sukses', `File CSV berhasil dibuat: ${fileUri}`);
    }
  } catch (error: unknown) {
    // Surface the actual error message so future failures are diagnosable
    // from the alert alone, without needing device logs.
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error exporting CSV:', error);
    Alert.alert('Gagal Export CSV', `Terjadi kesalahan saat meng-generate file CSV.\n\nDetail: ${message}`);
  }
};
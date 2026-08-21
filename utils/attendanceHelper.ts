import { AttendanceRecord } from '../service/attendanceService';

export interface AttendanceSummary {
  totalDays: number;
  presentCount: number;
  sickCount: number;
  permissionCount: number;
  absentCount: number;
  lateCount: number;
  attendanceRate: number | null; // null jika totalDays === 0 untuk cegah UX menyesatkan
}

export interface MonthlyAttendanceGroup {
  monthKey: string;   // Format: "YYYY-MM" (misal: "2026-08")
  monthLabel: string; // Format: "Agustus 2026"
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Menghitung akumulasi statistik presensi dari daftar record
 */
export const calculateAttendanceSummary = (records: AttendanceRecord[]): AttendanceSummary => {
  const totalDays = records.length;

  if (totalDays === 0) {
    return {
      totalDays: 0,
      presentCount: 0,
      sickCount: 0,
      permissionCount: 0,
      absentCount: 0,
      lateCount: 0,
      attendanceRate: null, // Dikembalikan null agar UI menampilkan "Belum Ada Data"
    };
  }

  let presentCount = 0;
  let sickCount = 0;
  let permissionCount = 0;
  let absentCount = 0;
  let lateCount = 0;

  records.forEach((rec) => {
    switch (rec.status) {
      case 'Present':
        presentCount++;
        break;
      case 'Sick':
        sickCount++;
        break;
      case 'Permission':
        permissionCount++;
        break;
      case 'Absent':
        absentCount++;
        break;
      case 'Late':
        lateCount++;
        break;
    }
  });

  // Hadir Fisik = Present + Late
  const physicalPresent = presentCount + lateCount;
  const attendanceRate = Math.round((physicalPresent / totalDays) * 100);

  return {
    totalDays,
    presentCount,
    sickCount,
    permissionCount,
    absentCount,
    lateCount,
    attendanceRate,
  };
};

/**
 * Mengelompokkan record presensi per bulan (Format YYYY-MM) dan mengurutkan secara Descending
 */
export const groupAttendanceByMonth = (records: AttendanceRecord[]): MonthlyAttendanceGroup[] => {
  const groupsMap = new Map<string, AttendanceRecord[]>();

  records.forEach((rec) => {
    // rec.date memiliki format YYYY-MM-DD
    const monthKey = rec.date ? rec.date.substring(0, 7) : 'Unknown';
    if (!groupsMap.has(monthKey)) {
      groupsMap.set(monthKey, []);
    }
    groupsMap.get(monthKey)!.push(rec);
  });

  const result: MonthlyAttendanceGroup[] = [];

  groupsMap.forEach((groupRecords, monthKey) => {
    // Urutkan record harian di dalam bulan secara descending (terbaru di atas)
    groupRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Format label bulan (misal "2026-08" -> "Agustus 2026")
    let monthLabel = monthKey;
    if (monthKey !== 'Unknown' && monthKey.includes('-')) {
      const [year, monthStr] = monthKey.split('-');
      const monthIndex = parseInt(monthStr, 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        monthLabel = `${MONTH_NAMES_ID[monthIndex]} ${year}`;
      }
    }

    result.push({
      monthKey,
      monthLabel,
      summary: calculateAttendanceSummary(groupRecords),
      records: groupRecords,
    });
  });

  // Urutkan grup bulan dari yang terbaru (descending)
  return result.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
};
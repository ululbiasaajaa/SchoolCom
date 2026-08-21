import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { AttendanceRecord } from '../service/attendanceService';
import {
  AssessmentConfig,
  FollowUpLog,
  Incident,
  Student,
  StudentAssessment,
} from '../types/schoolcom';
import { calculateAttendanceSummary } from './attendanceHelper';

// Fallback constant terpusat untuk Branding Identitas Sekolah
export const DEFAULT_SCHOOL_NAME = 'SchoolCom Learning Center';

/**
 * Merender string HTML berformat A4 printable rapor siswa.
 */
export const generateStudentReportHTML = (
  student: Student,
  config: AssessmentConfig,
  assessments: StudentAssessment[],
  teacherName: string = 'Guru Kelas',
  schoolName: string = DEFAULT_SCHOOL_NAME
): string => {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Sanitasi & Fallback nama sekolah untuk mencegah undefined/null/empty string
  const displaySchoolName = schoolName && schoolName.trim() ? schoolName.trim() : DEFAULT_SCHOOL_NAME;

  const studentAssessments = assessments.filter((a) => a.studentId === student.id);

  const hasAnyNumeric = config.subjects.some((s) => s.fields.enableNumeric);
  const hasAnyPredicate = config.subjects.some((s) => s.fields.enablePredicate);

  const rowsHTML = config.subjects
    .map((subject, index) => {
      const record = studentAssessments.find((a) => a.subjectId === subject.id);
      const fields = subject.fields;

      let scoreCell = '';
      if (hasAnyNumeric) {
        if (fields.enableNumeric) {
          const val = record?.score;
          scoreCell = `<td style="text-align: center; font-weight: bold;">${val !== null && val !== undefined ? val : '-'}</td>`;
        } else {
          scoreCell = `<td style="text-align: center; color: #9CA3AF;">-</td>`;
        }
      }

      let predicateCell = '';
      if (hasAnyPredicate) {
        if (fields.enablePredicate) {
          const val = record?.predicate;
          predicateCell = `<td style="text-align: center; font-weight: 600;">${val || '-'}</td>`;
        } else {
          predicateCell = `<td style="text-align: center; color: #9CA3AF;">-</td>`;
        }
      }

      let narrativeRow = '';
      if (fields.enableNarrative) {
        const val = record?.narrative;
        const totalColspan = 2 + (hasAnyNumeric ? 1 : 0) + (hasAnyPredicate ? 1 : 0);
        narrativeRow = `
          <tr style="background-color: #F9FAFB; page-break-inside: avoid;">
            <td colspan="${totalColspan}" style="padding: 10px 12px; font-size: 11px; color: #374151; border-bottom: 1px solid #E5E7EB; line-height: 1.5; word-break: break-word;">
              <strong>Catatan Perkembangan:</strong> ${val || '<span style="color: #9CA3AF; font-style: italic;">Belum ada catatan</span>'}
            </td>
          </tr>
        `;
      }

      return `
        <tr style="page-break-inside: avoid;">
          <td style="text-align: center; font-weight: 600;">${index + 1}</td>
          <td style="font-weight: 600; color: #1F2937;">${subject.name} <span style="font-size: 10px; color: #6B7280; font-weight: normal;">(${subject.category || 'Umum'})</span></td>
          ${scoreCell}
          ${predicateCell}
        </tr>
        ${narrativeRow}
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 15mm;
        }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #1F2937;
          margin: 0;
          padding: 0;
          font-size: 12px;
          line-height: 1.5;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #2563EB;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .school-name {
          font-size: 20px;
          font-weight: bold;
          color: #2563EB;
          letter-spacing: 1px;
        }
        .report-title {
          font-size: 14px;
          font-weight: bold;
          margin-top: 4px;
          color: #111827;
          text-transform: uppercase;
        }
        .meta-table {
          width: 100%;
          margin-bottom: 16px;
          border-collapse: collapse;
          page-break-inside: avoid;
        }
        .meta-table td {
          padding: 4px 0;
          vertical-align: top;
        }
        .meta-label {
          font-weight: 600;
          color: #4B5563;
          width: 120px;
        }
        .assessment-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        .assessment-table th {
          background-color: #2563EB;
          color: #FFFFFF;
          padding: 8px;
          font-size: 11px;
          text-align: left;
          border: 1px solid #1D4ED8;
        }
        .assessment-table td {
          padding: 8px;
          border: 1px solid #E5E7EB;
        }
        .footer-signatures {
          margin-top: 30px;
          width: 100%;
          border-collapse: collapse;
          page-break-inside: avoid;
        }
        .footer-signatures td {
          width: 50%;
          text-align: center;
          vertical-align: top;
        }
        .sig-space {
          height: 60px;
        }
        .timestamp-note {
          margin-top: 20px;
          font-size: 9px;
          color: #9CA3AF;
          text-align: right;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="school-name">${displaySchoolName}</div>
        <div class="report-title">Laporan Capaian Hasil Belajar Siswa (Rapor)</div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="meta-label">Nama Siswa</td>
          <td>: <strong>${student.name}</strong></td>
          <td class="meta-label">Tahun Ajaran</td>
          <td>: ${config.academicYear}</td>
        </tr>
        <tr>
          <td class="meta-label">Kelas</td>
          <td>: ${student.className || '-'}</td>
          <td class="meta-label">Semester</td>
          <td>: ${config.term}</td>
        </tr>
        <tr>
          <td class="meta-label">Tanggal Lahir</td>
          <td>: ${student.dob || '-'}</td>
          <td class="meta-label">Guru Kelas</td>
          <td>: ${teacherName}</td>
        </tr>
      </table>

      <table class="assessment-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">No</th>
            <th>Mata Pelajaran / Aspek Perkembangan</th>
            ${hasAnyNumeric ? '<th style="width: 80px; text-align: center;">Nilai</th>' : ''}
            ${hasAnyPredicate ? '<th style="width: 110px; text-align: center;">Predikat</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>

      <table class="footer-signatures">
        <tr>
          <td>
            <div>Mengetahui,</div>
            <div><strong>Orang Tua / Wali Siswa</strong></div>
            <div class="sig-space"></div>
            <div>( ________________________ )</div>
          </td>
          <td>
            <div>Dicetak tanggal: ${currentDate}</div>
            <div><strong>Guru Kelas</strong></div>
            <div class="sig-space"></div>
            <div>( <strong>${teacherName}</strong> )</div>
          </td>
        </tr>
      </table>

      <div class="timestamp-note">
        Dokumen ini dihasilkan secara otomatis oleh Sistem Manajemen Sekolah SchoolCom.
      </div>
    </body>
    </html>
  `;
};

/**
 * Memicu pembuat PDF dan membuka dialog share/print native device (Rapor Akademik).
 */
export const exportStudentReportPDF = async (
  student: Student,
  config: AssessmentConfig,
  assessments: StudentAssessment[],
  teacherName: string = 'Guru',
  schoolName: string = DEFAULT_SCHOOL_NAME
): Promise<void> => {
  try {
    const html = generateStudentReportHTML(student, config, assessments, teacherName, schoolName);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Rapor ${student.name} - ${config.academicYear} ${config.term}`,
      });
    } else {
      Alert.alert('Sukses', `PDF Rapor berhasil dibuat: ${uri}`);
    }
  } catch (error: unknown) {
    console.error('Error generating PDF report:', error);
    Alert.alert('Gagal Export PDF', 'Terjadi kesalahan saat membuat dokumen PDF Rapor.');
  }
};

/**
 * Merender string HTML berformat A4 printable rekapitulasi catatan insiden & perilaku siswa.
 */
export const generateStudentIncidentReportHTML = (
  student: Student,
  incidents: Incident[],
  teacherName: string = 'Guru / Wali Kelas',
  schoolName: string = DEFAULT_SCHOOL_NAME
): string => {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const displaySchoolName = schoolName && schoolName.trim() ? schoolName.trim() : DEFAULT_SCHOOL_NAME;

  // Filter insiden milik siswa spesifik ini & urutkan dari yang terbaru
  const studentIncidents = incidents
    .filter((i) => i.studentId === student.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Metrics agregasi insiden
  const totalIncidents = studentIncidents.length;
  const pendingCount = studentIncidents.filter((i) => i.status === 'Pending').length;
  const followUpCount = studentIncidents.filter((i) => i.status === 'Follow-up').length;
  const resolvedCount = studentIncidents.filter((i) => i.status === 'Resolved').length;

  const incidentsHTML =
    studentIncidents.length > 0
      ? studentIncidents
          .map((item, index) => {
            // Priority badge styling
            let priorityBg = '#F3F4F6';
            let priorityColor = '#374151';
            if (item.priority === 'Critical') {
              priorityBg = '#FEE2E2';
              priorityColor = '#DC2626';
            } else if (item.priority === 'High') {
              priorityBg = '#FEF3C7';
              priorityColor = '#D97706';
            } else if (item.priority === 'Medium') {
              priorityBg = '#DBEAFE';
              priorityColor = '#2563EB';
            } else if (item.priority === 'Low') {
              priorityBg = '#D1FAE5';
              priorityColor = '#059669';
            }

            // Status badge styling
            let statusBg = '#FEF3C7';
            let statusColor = '#D97706';
            if (item.status === 'Resolved') {
              statusBg = '#D1FAE5';
              statusColor = '#059669';
            } else if (item.status === 'Follow-up') {
              statusBg = '#DBEAFE';
              statusColor = '#2563EB';
            }

            // Render follow-up logs jika ada
            let followUpLogsHTML = '';
            if (item.followUpLogs && item.followUpLogs.length > 0) {
              const logsList = item.followUpLogs
                .filter((log: FollowUpLog) => log.note && log.note.trim().length > 0)
                .map(
                  (log: FollowUpLog) => `
                  <div style="background-color: #FFFFFF; padding: 6px 8px; border-radius: 4px; margin-top: 4px; border: 1px solid #E5E7EB; font-size: 10px;">
                    <div><strong>${log.author || 'Guru'}</strong> • <span style="color: #6B7280;">${log.updatedAt || log.date || '-'}</span></div>
                    <div style="color: #374151; margin-top: 2px;">${log.note}</div>
                  </div>
                `
                )
                .join('');

              if (logsList) {
                followUpLogsHTML = `
                  <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #D1D5DB;">
                    <div style="font-size: 10px; font-weight: bold; color: #4B5563;">Riwayat Catatan Tindak Lanjut (${item.followUpLogs.length}):</div>
                    ${logsList}
                  </div>
                `;
              }
            }

            return `
              <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                  <div>
                    <span style="font-weight: bold; font-size: 13px; color: #111827;">#${index + 1} • ${item.category}</span>
                    <span style="font-size: 11px; color: #6B7280; margin-left: 8px;">(${item.date || item.createdAt.split(' ')[0]})</span>
                  </div>
                  <div>
                    <span style="background-color: ${priorityBg}; color: ${priorityColor}; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; margin-right: 4px;">${item.priority || 'Medium'}</span>
                    <span style="background-color: ${statusBg}; color: ${statusColor}; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">${item.status || 'Pending'}</span>
                  </div>
                </div>

                <div style="font-size: 10px; color: #6B7280; margin-bottom: 6px;">
                  Pelapor: <strong>${item.teacherName || 'Guru'}</strong>
                </div>

                <div style="font-size: 12px; color: #1F2937; margin-bottom: 6px; line-height: 1.4;">
                  <strong>Deskripsi Kejadian:</strong> ${item.description}
                </div>

                ${
                  item.actionTaken
                    ? `<div style="font-size: 11px; color: #1E40AF; background-color: #EFF6FF; padding: 6px 8px; border-radius: 4px; border-left: 3px solid #2563EB;">
                        <strong>Tindakan Awal Guru:</strong> ${item.actionTaken}
                      </div>`
                    : ''
                }

                ${followUpLogsHTML}
              </div>
            `;
          })
          .join('')
      : `
        <div style="text-align: center; padding: 24px; background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; color: #6B7280; font-style: italic;">
          Belum ada catatan observasi atau insiden terdaftar untuk siswa ini.
        </div>
      `;

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 15mm;
        }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #1F2937;
          margin: 0;
          padding: 0;
          font-size: 12px;
          line-height: 1.5;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #2563EB;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .school-name {
          font-size: 20px;
          font-weight: bold;
          color: #2563EB;
          letter-spacing: 1px;
        }
        .report-title {
          font-size: 14px;
          font-weight: bold;
          margin-top: 4px;
          color: #111827;
          text-transform: uppercase;
        }
        .meta-table {
          width: 100%;
          margin-bottom: 16px;
          border-collapse: collapse;
          page-break-inside: avoid;
        }
        .meta-table td {
          padding: 4px 0;
          vertical-align: top;
        }
        .meta-label {
          font-weight: 600;
          color: #4B5563;
          width: 120px;
        }
        .summary-box {
          display: flex;
          justify-content: space-between;
          background-color: #EFF6FF;
          border: 1px solid #BFDBFE;
          border-radius: 8px;
          padding: 10px 16px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .summary-item {
          text-align: center;
        }
        .summary-val {
          font-size: 16px;
          font-weight: bold;
          color: #1E40AF;
        }
        .summary-lbl {
          font-size: 10px;
          color: #4B5563;
        }
        .section-title {
          font-size: 14px;
          font-weight: bold;
          color: #111827;
          margin-bottom: 12px;
          border-bottom: 1px solid #E5E7EB;
          padding-bottom: 4px;
        }
        .footer-signatures {
          margin-top: 30px;
          width: 100%;
          border-collapse: collapse;
          page-break-inside: avoid;
        }
        .footer-signatures td {
          width: 50%;
          text-align: center;
          vertical-align: top;
        }
        .sig-space {
          height: 60px;
        }
        .timestamp-note {
          margin-top: 20px;
          font-size: 9px;
          color: #9CA3AF;
          text-align: right;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="school-name">${displaySchoolName}</div>
        <div class="report-title">Laporan Rekapitulasi Catatan Perilaku & Observasi Siswa</div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="meta-label">Nama Siswa</td>
          <td>: <strong>${student.name}</strong></td>
          <td class="meta-label">Tanggal Cetak</td>
          <td>: ${currentDate}</td>
        </tr>
        <tr>
          <td class="meta-label">Kelas</td>
          <td>: ${student.className || '-'}</td>
          <td class="meta-label">Wali / Guru Kelas</td>
          <td>: ${teacherName}</td>
        </tr>
      </table>

      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-val">${totalIncidents}</div>
          <div class="summary-lbl">Total Catatan</div>
        </div>
        <div class="summary-item">
          <div class="summary-val" style="color: #D97706;">${pendingCount}</div>
          <div class="summary-lbl">Pending</div>
        </div>
        <div class="summary-item">
          <div class="summary-val" style="color: #2563EB;">${followUpCount}</div>
          <div class="summary-lbl">Follow-Up</div>
        </div>
        <div class="summary-item">
          <div class="summary-val" style="color: #059669;">${resolvedCount}</div>
          <div class="summary-lbl">Resolved</div>
        </div>
      </div>

      <div class="section-title">Daftar Kronologis Observasi & Insiden</div>
      ${incidentsHTML}

      <table class="footer-signatures">
        <tr>
          <td>
            <div>Mengetahui,</div>
            <div><strong>Orang Tua / Wali Siswa</strong></div>
            <div class="sig-space"></div>
            <div>( ________________________ )</div>
          </td>
          <td>
            <div>Dicetak tanggal: ${currentDate}</div>
            <div><strong>Guru / Wali Kelas</strong></div>
            <div class="sig-space"></div>
            <div>( <strong>${teacherName}</strong> )</div>
          </td>
        </tr>
      </table>

      <div class="timestamp-note">
        Dokumen ini dihasilkan secara otomatis oleh Sistem Manajemen Sekolah SchoolCom.
      </div>
    </body>
    </html>
  `;
};

/**
 * Memicu pembuat PDF dan membuka dialog share/print native device (Rekap Catatan Perilaku/Insiden).
 */
export const exportStudentIncidentReportPDF = async (
  student: Student,
  incidents: Incident[],
  teacherName: string = 'Guru',
  schoolName: string = DEFAULT_SCHOOL_NAME
): Promise<void> => {
  try {
    const html = generateStudentIncidentReportHTML(student, incidents, teacherName, schoolName);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Rekap Perilaku ${student.name}`,
      });
    } else {
      Alert.alert('Sukses', `PDF Rekap Perilaku berhasil dibuat: ${uri}`);
    }
  } catch (error: unknown) {
    console.error('Error generating incident PDF report:', error);
    Alert.alert('Gagal Export PDF', 'Terjadi kesalahan saat membuat dokumen PDF Rekap Perilaku.');
  }
};

/**
 * Merender string HTML berformat A4 printable rekapitulasi presensi & kehadiran siswa.
 */
export const generateStudentAttendanceReportHTML = (
  student: Student,
  attendanceRecords: AttendanceRecord[],
  teacherName: string = 'Guru / Wali Kelas',
  schoolName: string = DEFAULT_SCHOOL_NAME
): string => {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const displaySchoolName = schoolName && schoolName.trim() ? schoolName.trim() : DEFAULT_SCHOOL_NAME;

  // Filter presensi milik siswa ini & urutkan dari yang terbaru
  const studentAttendance = attendanceRecords
    .filter((a) => a.studentId === student.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Kalkulasi ringkasan presensi menggunakan helper Phase 14
  const summary = calculateAttendanceSummary(studentAttendance);

  const rowsHTML =
    studentAttendance.length > 0
      ? studentAttendance
          .map((rec, index) => {
            let statusLabel: string = rec.status;
            let statusBg = '#F3F4F6';
            let statusColor = '#374151';

            if (rec.status === 'Present') {
              statusLabel = 'Hadir';
              statusBg = '#D1FAE5';
              statusColor = '#059669';
            } else if (rec.status === 'Sick') {
              statusLabel = 'Sakit';
              statusBg = '#FFEDD5';
              statusColor = '#C2410C';
            } else if (rec.status === 'Permission') {
              statusLabel = 'Izin';
              statusBg = '#DBEAFE';
              statusColor = '#1D4ED8';
            } else if (rec.status === 'Absent') {
              statusLabel = 'Alpha';
              statusBg = '#FEE2E2';
              statusColor = '#DC2626';
            } else if (rec.status === 'Late') {
              statusLabel = 'Terlambat';
              statusBg = '#F3E8FF';
              statusColor = '#6B21A8';
            }

            return `
              <tr style="page-break-inside: avoid;">
                <td style="text-align: center; font-weight: 600; color: #6B7280;">${index + 1}</td>
                <td style="font-weight: 600; color: #111827;">${rec.date}</td>
                <td style="text-align: center;">
                  <span style="background-color: ${statusBg}; color: ${statusColor}; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: bold; display: inline-block;">
                    ${statusLabel}
                  </span>
                </td>
                <td style="color: #4B5563; font-size: 11px;">${rec.teacherName || teacherName}</td>
              </tr>
            `;
          })
          .join('')
      : `
        <tr>
          <td colspan="4" style="text-align: center; padding: 18px; color: #9CA3AF; font-style: italic;">
            Belum ada data riwayat presensi tercatat untuk siswa ini.
          </td>
        </tr>
      `;

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 15mm;
        }
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #1F2937;
          margin: 0;
          padding: 0;
          font-size: 12px;
          line-height: 1.5;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #2563EB;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .school-name {
          font-size: 20px;
          font-weight: bold;
          color: #2563EB;
          letter-spacing: 1px;
        }
        .report-title {
          font-size: 14px;
          font-weight: bold;
          margin-top: 4px;
          color: #111827;
          text-transform: uppercase;
        }
        .meta-table {
          width: 100%;
          margin-bottom: 16px;
          border-collapse: collapse;
          page-break-inside: avoid;
        }
        .meta-table td {
          padding: 4px 0;
          vertical-align: top;
        }
        .meta-label {
          font-weight: 600;
          color: #4B5563;
          width: 120px;
        }
        .summary-box {
          display: flex;
          justify-content: space-between;
          background-color: #F0FDF4;
          border: 1px solid #BBF7D0;
          border-radius: 8px;
          padding: 10px 16px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .summary-item {
          text-align: center;
        }
        .summary-val {
          font-size: 15px;
          font-weight: bold;
          color: #15803D;
        }
        .summary-lbl {
          font-size: 10px;
          color: #4B5563;
        }
        .attendance-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        .attendance-table th {
          background-color: #2563EB;
          color: #FFFFFF;
          padding: 8px;
          font-size: 11px;
          text-align: left;
          border: 1px solid #1D4ED8;
        }
        .attendance-table td {
          padding: 8px;
          border: 1px solid #E5E7EB;
        }
        .footer-signatures {
          margin-top: 30px;
          width: 100%;
          border-collapse: collapse;
          page-break-inside: avoid;
        }
        .footer-signatures td {
          width: 50%;
          text-align: center;
          vertical-align: top;
        }
        .sig-space {
          height: 60px;
        }
        .timestamp-note {
          margin-top: 20px;
          font-size: 9px;
          color: #9CA3AF;
          text-align: right;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="school-name">${displaySchoolName}</div>
        <div class="report-title">Laporan Rekapitulasi Presensi & Kehadiran Siswa</div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="meta-label">Nama Siswa</td>
          <td>: <strong>${student.name}</strong></td>
          <td class="meta-label">Tanggal Cetak</td>
          <td>: ${currentDate}</td>
        </tr>
        <tr>
          <td class="meta-label">Kelas</td>
          <td>: ${student.className || '-'}</td>
          <td class="meta-label">Wali / Guru Kelas</td>
          <td>: ${teacherName}</td>
        </tr>
      </table>

      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-val">${summary.attendanceRate !== null ? `${summary.attendanceRate}%` : '-'}</div>
          <div class="summary-lbl">Tingkat Kehadiran</div>
        </div>
        <div class="summary-item">
          <div class="summary-val" style="color: #059669;">${summary.presentCount} Hari</div>
          <div class="summary-lbl">Hadir</div>
        </div>
        <div class="summary-item">
          <div class="summary-val" style="color: #7C3AED;">${summary.lateCount} Hari</div>
          <div class="summary-lbl">Terlambat</div>
        </div>
        <div class="summary-item">
          <div class="summary-val" style="color: #D97706;">${summary.sickCount} Hari</div>
          <div class="summary-lbl">Sakit</div>
        </div>
        <div class="summary-item">
          <div class="summary-val" style="color: #2563EB;">${summary.permissionCount} Hari</div>
          <div class="summary-lbl">Izin</div>
        </div>
        <div class="summary-item">
          <div class="summary-val" style="color: #DC2626;">${summary.absentCount} Hari</div>
          <div class="summary-lbl">Alpha</div>
        </div>
      </div>

      <table class="attendance-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">No</th>
            <th style="width: 140px;">Tanggal Presensi</th>
            <th style="width: 110px; text-align: center;">Status Kehadiran</th>
            <th>Penginput / Guru</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>

      <table class="footer-signatures">
        <tr>
          <td>
            <div>Mengetahui,</div>
            <div><strong>Orang Tua / Wali Siswa</strong></div>
            <div class="sig-space"></div>
            <div>( ________________________ )</div>
          </td>
          <td>
            <div>Dicetak tanggal: ${currentDate}</div>
            <div><strong>Guru / Wali Kelas</strong></div>
            <div class="sig-space"></div>
            <div>( <strong>${teacherName}</strong> )</div>
          </td>
        </tr>
      </table>

      <div class="timestamp-note">
        Dokumen ini dihasilkan secara otomatis oleh Sistem Manajemen Sekolah SchoolCom.
      </div>
    </body>
    </html>
  `;
};

/**
 * Memicu pembuat PDF dan membuka dialog share/print native device (Rekap Presensi & Kehadiran).
 */
export const exportStudentAttendanceReportPDF = async (
  student: Student,
  attendanceRecords: AttendanceRecord[],
  teacherName: string = 'Guru',
  schoolName: string = DEFAULT_SCHOOL_NAME
): Promise<void> => {
  try {
    const html = generateStudentAttendanceReportHTML(student, attendanceRecords, teacherName, schoolName);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Rekap Presensi ${student.name}`,
      });
    } else {
      Alert.alert('Sukses', `PDF Rekap Presensi berhasil dibuat: ${uri}`);
    }
  } catch (error: unknown) {
    console.error('Error generating attendance PDF report:', error);
    Alert.alert('Gagal Export PDF', 'Terjadi kesalahan saat membuat dokumen PDF Rekap Presensi.');
  }
};
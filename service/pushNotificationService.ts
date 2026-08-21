import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessagePayload {
  to: string; // Expo Push Token string (misal: "ExponentPushToken[xxx]")
  sound?: 'default';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Helper internal untuk mengirim satu atau beberapa payload notifikasi ke Expo Push API.
 */
async function sendExpoPushNotifications(messages: PushMessagePayload[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.warn('[PushNotificationService] Response error dari Expo Push API:', response.status);
    } else {
      console.log(`[PushNotificationService] Berhasil mengirim ${messages.length} notifikasi push.`);
    }
  } catch (error: unknown) {
    console.error('[PushNotificationService] Gagal mengirim HTTP request ke Expo Push API:', error);
  }
}

/**
 * EVT-01 & EVT-02: Mengirim Notifikasi Insiden / Perilaku Baru ke Parent dari siswa terkait.
 */
export async function notifyParentOnIncident(
  studentId: string,
  studentName: string,
  category: string,
  titleText: string = 'Catatan Perilaku Baru'
): Promise<void> {
  try {
    // Cari dokumen pushTokens milik Parent yang memiliki studentId ini
    const q = query(
      collection(db, 'pushTokens'),
      where('role', '==', 'parent'),
      where('studentIds', 'array-contains', studentId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log(`[PushNotificationService] Tidak ada Push Token terdaftar untuk Parent dari studentId: ${studentId}`);
      return;
    }

    const messages: PushMessagePayload[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.pushToken) {
        messages.push({
          to: data.pushToken,
          sound: 'default',
          title: `📋 ${titleText}`,
          body: `Catatan ${category} untuk ${studentName} telah diperbarui oleh guru.`,
          data: { studentId, type: 'incident' },
        });
      }
    });

    await sendExpoPushNotifications(messages);
  } catch (error: unknown) {
    console.error('[PushNotificationService] Error pada notifyParentOnIncident:', error);
  }
}

/**
 * EVT-03: Mengirim Notifikasi Presensi Harian (Sakit/Izin/Alpha/Terlambat) ke Parent.
 */
export async function notifyParentOnAttendance(
  studentId: string,
  studentName: string,
  statusLabel: string,
  dateStr: string
): Promise<void> {
  try {
    const q = query(
      collection(db, 'pushTokens'),
      where('role', '==', 'parent'),
      where('studentIds', 'array-contains', studentId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const messages: PushMessagePayload[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.pushToken) {
        messages.push({
          to: data.pushToken,
          sound: 'default',
          title: '📅 Update Kehadiran Siswa',
          body: `Status kehadiran ${studentName} pada ${dateStr} dicatat sebagai: ${statusLabel}.`,
          data: { studentId, type: 'attendance' },
        });
      }
    });

    await sendExpoPushNotifications(messages);
  } catch (error: unknown) {
    console.error('[PushNotificationService] Error pada notifyParentOnAttendance:', error);
  }
}

/**
 * EVT-04: Mengirim Notifikasi Publikasi Nilai / Rapor Baru ke Parent.
 */
export async function notifyParentOnAssessment(
  studentId: string,
  studentName: string,
  subjectName: string
): Promise<void> {
  try {
    const q = query(
      collection(db, 'pushTokens'),
      where('role', '==', 'parent'),
      where('studentIds', 'array-contains', studentId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const messages: PushMessagePayload[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.pushToken) {
        messages.push({
          to: data.pushToken,
          sound: 'default',
          title: '📊 Penilaian Akademik Baru',
          body: `Nilai/catatan perkembangan ${subjectName} untuk ${studentName} telah diperbarui.`,
          data: { studentId, type: 'assessment' },
        });
      }
    });

    await sendExpoPushNotifications(messages);
  } catch (error: unknown) {
    console.error('[PushNotificationService] Error pada notifyParentOnAssessment:', error);
  }
}
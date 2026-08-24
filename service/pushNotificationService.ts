import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

export interface PushMessagePayload {
  to: string; // Expo Push Token string (misal: "ExponentPushToken[xxx]")
  sound?: 'default';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export type BroadcastTargetRole = 'all' | 'parent' | 'teacher';

/**
 * Helper internal untuk mengirim satu atau beberapa payload notifikasi ke Expo Push API.
 * Dilengkapi dengan chunking otomatis (maksimal 100 messages per HTTP request).
 */
async function sendExpoPushNotifications(messages: PushMessagePayload[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    // Chunking array messages agar tidak melebihi batas 100 item per request Expo Push API
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.warn(
          `[PushNotificationService] Response error (${response.status}) pada chunk ${i / CHUNK_SIZE + 1}`
        );
      } else {
        console.log(
          `[PushNotificationService] Berhasil mengirim ${chunk.length} notifikasi push (Chunk ${i / CHUNK_SIZE + 1}).`
        );
      }
    }
  } catch (error: unknown) {
    console.error('[PushNotificationService] Gagal mengirim HTTP request ke Expo Push API:', error);
  }
}

/**
 * Helper internal untuk mendapatkan seluruh token milik Parent yang terhubung ke studentId tertentu
 * (Double Coverage: Mencari dari koleksi 'pushTokens' dan fallback ke 'users').
 */
async function getParentPushTokens(studentId: string): Promise<string[]> {
  const tokens: Set<string> = new Set();

  try {
    // 1. Cari di koleksi 'pushTokens'
    const qPushTokens = query(
      collection(db, 'pushTokens'),
      where('role', '==', 'parent'),
      where('studentIds', 'array-contains', studentId)
    );
    const snapPush = await getDocs(qPushTokens);
    snapPush.forEach((docSnap) => {
      const data = docSnap.data();
      if (typeof data.pushToken === 'string' && data.pushToken.length > 0) {
        tokens.add(data.pushToken);
      }
    });

    // 2. Double-check di koleksi 'users'
    const qUsers = query(
      collection(db, 'users'),
      where('role', '==', 'parent'),
      where('studentIds', 'array-contains', studentId)
    );
    const snapUsers = await getDocs(qUsers);
    snapUsers.forEach((docSnap) => {
      const data = docSnap.data();
      if (typeof data.pushToken === 'string' && data.pushToken.length > 0) {
        tokens.add(data.pushToken);
      }
      if (typeof data.expoPushToken === 'string' && data.expoPushToken.length > 0) {
        tokens.add(data.expoPushToken);
      }
    });
  } catch (err: unknown) {
    console.error('[PushNotificationService] Error querying parent tokens:', err);
  }

  return Array.from(tokens);
}

/**
 * Helper internal untuk mendapatkan token pengguna berdasarkan Role atau Broadcast All.
 */
async function getBroadcastPushTokens(targetRole: BroadcastTargetRole): Promise<string[]> {
  const tokens: Set<string> = new Set();

  try {
    // Fetch dari koleksi 'pushTokens'
    const pushRef = collection(db, 'pushTokens');
    const qPush =
      targetRole === 'all'
        ? query(pushRef)
        : query(pushRef, where('role', '==', targetRole));

    const snapPush = await getDocs(qPush);
    snapPush.forEach((docSnap) => {
      const data = docSnap.data();
      if (typeof data.pushToken === 'string' && data.pushToken.length > 0) {
        tokens.add(data.pushToken);
      }
    });

    // Double check ke koleksi 'users'
    const usersRef = collection(db, 'users');
    const qUsers =
      targetRole === 'all'
        ? query(usersRef)
        : query(usersRef, where('role', '==', targetRole));

    const snapUsers = await getDocs(qUsers);
    snapUsers.forEach((docSnap) => {
      const data = docSnap.data();
      if (typeof data.pushToken === 'string' && data.pushToken.length > 0) {
        tokens.add(data.pushToken);
      }
      if (typeof data.expoPushToken === 'string' && data.expoPushToken.length > 0) {
        tokens.add(data.expoPushToken);
      }
    });
  } catch (err: unknown) {
    console.error('[PushNotificationService] Error fetching broadcast tokens:', err);
  }

  return Array.from(tokens);
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
    const parentTokens = await getParentPushTokens(studentId);

    if (parentTokens.length === 0) {
      console.log(
        `[PushNotificationService] Tidak ada Push Token terdaftar untuk Parent dari studentId: ${studentId}`
      );
      return;
    }

    const messages: PushMessagePayload[] = parentTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: `📋 ${titleText}`,
      body: `Catatan ${category} untuk ${studentName} telah diperbarui oleh guru.`,
      data: { studentId, type: 'incident' },
    }));

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
    const parentTokens = await getParentPushTokens(studentId);
    if (parentTokens.length === 0) return;

    const messages: PushMessagePayload[] = parentTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: '📅 Update Kehadiran Siswa',
      body: `Status kehadiran ${studentName} pada ${dateStr} dicatat sebagai: ${statusLabel}.`,
      data: { studentId, type: 'attendance' },
    }));

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
    const parentTokens = await getParentPushTokens(studentId);
    if (parentTokens.length === 0) return;

    const messages: PushMessagePayload[] = parentTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: '📊 Penilaian Akademik Baru',
      body: `Nilai/catatan perkembangan ${subjectName} untuk ${studentName} telah diperbarui.`,
      data: { studentId, type: 'assessment' },
    }));

    await sendExpoPushNotifications(messages);
  } catch (error: unknown) {
    console.error('[PushNotificationService] Error pada notifyParentOnAssessment:', error);
  }
}

/**
 * EVT-05 (BROADCAST): Mengirim Pengumuman Massal ke Seluruh Pengguna / Parent / Teacher.
 */
export async function sendBroadcastNotification(
  title: string,
  body: string,
  targetRole: BroadcastTargetRole = 'all'
): Promise<void> {
  try {
    const tokens = await getBroadcastPushTokens(targetRole);

    if (tokens.length === 0) {
      console.log(`[PushNotificationService] Tidak ada Push Token ditemukan untuk target broadcast: ${targetRole}`);
      return;
    }

    const messages: PushMessagePayload[] = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: `📢 ${title}`,
      body,
      data: { type: 'broadcast', targetRole },
    }));

    await sendExpoPushNotifications(messages);
  } catch (error: unknown) {
    console.error('[PushNotificationService] Error pada sendBroadcastNotification:', error);
  }
}
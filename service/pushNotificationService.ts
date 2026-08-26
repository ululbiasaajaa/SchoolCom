import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
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
 * Dilengkapi dengan chunking otomatis (maksimal 100 messages per HTTP request)
 * DAN pengecekan tiket per-message (Expo tetap balikin HTTP 200 walau ada token individual yang gagal).
 */
async function sendExpoPushNotifications(messages: PushMessagePayload[]): Promise<void> {
  if (messages.length === 0) return;

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    const chunkNumber = i / CHUNK_SIZE + 1;

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        console.error(
          `[PushNotificationService] Response error (${response.status}) pada chunk ${chunkNumber}:`,
          JSON.stringify(result)
        );
        continue;
      }

      const tickets = result?.data;
      if (Array.isArray(tickets)) {
        tickets.forEach((ticket: any, idx: number) => {
          if (ticket.status === 'error') {
            console.error(
              `[PushNotificationService] Gagal kirim ke token #${idx} chunk ${chunkNumber} (${chunk[idx]?.to}):`,
              ticket.message,
              ticket.details
            );
          }
        });
      }

      console.log(
        `[PushNotificationService] Berhasil mengirim ${chunk.length} notifikasi push (Chunk ${chunkNumber}). Response:`,
        JSON.stringify(result)
      );
    } catch (error: unknown) {
      console.error(`[PushNotificationService] Gagal mengirim HTTP request ke Expo Push API (Chunk ${chunkNumber}):`, error);
    }
  }
}

/**
 * Helper internal untuk mendapatkan seluruh token milik Parent yang terhubung ke studentId tertentu.
 *
 * PENTING: Fungsi ini SENGAJA tidak melakukan query() langsung ke koleksi 'pushTokens'
 * dengan filter role/studentIds. Rules Firestore untuk 'pushTokens' butuh get() tambahan
 * ke koleksi 'students' (lewat isTeacherOfParent) yang nilainya beda-beda per dokumen —
 * Firestore tidak bisa membuktikan rule itu valid untuk SEMUA kemungkinan hasil query
 * (list request), jadi query kayak gitu selalu ditolak permission-denied walau
 * per-dokumen sebenarnya lolos.
 *
 * Solusinya: cari dulu UID parent lewat koleksi 'users' (bebas dibaca semua authenticated
 * user), lalu ambil token per UID pakai getDoc() satu-satu — getDoc dievaluasi langsung
 * ke resource.data dokumen itu doang, jadi rules-nya tetap berlaku normal.
 */
async function getParentPushTokens(studentId: string): Promise<string[]> {
  const tokens: Set<string> = new Set();

  try {
    const qUsers = query(
      collection(db, 'users'),
      where('role', '==', 'parent'),
      where('studentIds', 'array-contains', studentId)
    );
    const snapUsers = await getDocs(qUsers);
    const parentUids = snapUsers.docs.map((d) => d.id);
    console.log(`[PushNotificationService] Ditemukan ${parentUids.length} parent untuk studentId=${studentId}.`);

    if (parentUids.length === 0) {
      return [];
    }

    await Promise.all(
      parentUids.map(async (uid) => {
        try {
          const tokenSnap = await getDoc(doc(db, 'pushTokens', uid));
          if (tokenSnap.exists()) {
            const data = tokenSnap.data();
            if (typeof data.pushToken === 'string' && data.pushToken.length > 0) {
              tokens.add(data.pushToken);
            }
          }
        } catch (innerErr: any) {
          console.warn(
            `[PushNotificationService] Gagal baca pushTokens/${uid}. code:`, innerErr?.code, 'message:', innerErr?.message
          );
        }
      })
    );
  } catch (err: any) {
    console.error(
      '[PushNotificationService] Error mencari parent via users. code:', err?.code, 'message:', err?.message, err
    );
  }

  return Array.from(tokens);
}

/**
 * Helper internal untuk mendapatkan token pengguna berdasarkan Role atau Broadcast All.
 * Catatan: hanya aman dipanggil dari akun ADMIN — isAdmin() di rules tidak bergantung
 * ke resource.data, jadi query list ke 'pushTokens' ini valid untuk admin.
 * JANGAN panggil ini dari akun teacher/parent, akan kena permission-denied yang sama
 * seperti kasus getParentPushTokens di atas.
 */
async function getBroadcastPushTokens(targetRole: BroadcastTargetRole): Promise<string[]> {
  const tokens: Set<string> = new Set();

  try {
    const pushRef = collection(db, 'pushTokens');
    const qPush = targetRole === 'all' ? query(pushRef) : query(pushRef, where('role', '==', targetRole));

    const snapPush = await getDocs(qPush);
    console.log(`[PushNotificationService] Query broadcast pushTokens role=${targetRole} -> ${snapPush.size} dokumen.`);
    snapPush.forEach((docSnap) => {
      const data = docSnap.data();
      if (typeof data.pushToken === 'string' && data.pushToken.length > 0) {
        tokens.add(data.pushToken);
      }
    });
  } catch (err: any) {
    console.error(
      '[PushNotificationService] Error fetching broadcast pushTokens. code:', err?.code, 'message:', err?.message, err
    );
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
      console.warn(`[PushNotificationService] Tidak ada Push Token terdaftar/terbaca untuk Parent dari studentId: ${studentId}`);
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
    if (parentTokens.length === 0) {
      console.warn(`[PushNotificationService] Tidak ada Push Token terdaftar/terbaca untuk Parent dari studentId: ${studentId}`);
      return;
    }

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
    if (parentTokens.length === 0) {
      console.warn(`[PushNotificationService] Tidak ada Push Token terdaftar/terbaca untuk Parent dari studentId: ${studentId}`);
      return;
    }

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
 * WAJIB dipanggil dari akun ADMIN saja (lihat catatan di getBroadcastPushTokens).
 */
export async function sendBroadcastNotification(
  title: string,
  body: string,
  targetRole: BroadcastTargetRole = 'all'
): Promise<void> {
  try {
    const tokens = await getBroadcastPushTokens(targetRole);

    if (tokens.length === 0) {
      console.warn(`[PushNotificationService] Tidak ada Push Token ditemukan untuk target broadcast: ${targetRole}`);
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
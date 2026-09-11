import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteDoc, deleteField, doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';
import { User } from '../types/schoolcom';

// Konfigurasi default handler notifikasi foreground (Expo SDK Terbaru)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface PushTokenDocument {
  pushToken: string;
  role: 'admin' | 'teacher' | 'parent';
  platform: string;
  studentIds?: string[];
  assignedClasses?: string[];
  updatedAt: string;
}

/**
 * Meminta izin notifikasi ke OS dan mengambil Expo Push Token jika berjalan di device fisik.
 */
export async function registerForPushNotificationsAsync(
  user: User
): Promise<string | null> {
  // Guard 1: Push notification hanya berfungsi di device fisik, bukan simulator/emulator
  if (!Device.isDevice) {
    console.log('[PushTokenService] Push Notification diabaikan: Berjalan di Emulator/Simulator.');
    return null;
  }

  try {
    // 1. Cek & Minta Izin Notification
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushTokenService] Izin notifikasi ditolak oleh pengguna.');
      return null;
    }

    // 2. Setup Channel Khusus Android (Wajib untuk Android 8.0+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    }

    // 3. Ambil projectId (WAJIB di-pass eksplisit, terutama untuk EAS/preview/production build)
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        '[PushTokenService] Project ID tidak ditemukan. Pastikan extra.eas.projectId ada di app.json/app.config.'
      );
      return null;
    }

    // 4. Dapatkan Expo Push Token
    let token: string;
    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenResponse.data;
    } catch (tokenError: unknown) {
      console.error('[PushTokenService] Gagal mengambil Expo Push Token:', tokenError);
      return null;
    }

    if (!token) {
      console.warn('[PushTokenService] Gagal mendapatkan Expo Push Token string.');
      return null;
    }

    // 5. Simpan/Update Token ke Firestore Collection pushTokens/{uid}
    const tokenDocRef = doc(db, 'pushTokens', user.uid);
    const tokenPayload: Record<string, unknown> = {
      pushToken: token,
      role: user.role,
      platform: Platform.OS,
      updatedAt: new Date().toISOString(),
    };

    // FIX BUG: sebelumnya field studentIds/assignedClasses cuma DIMASUKKIN kalau
    // array-nya gak kosong — kalau kosong, field itu SAMA SEKALI gak disentuh di
    // payload. Karena setDoc pakai { merge: true }, itu artinya nilai LAMA di
    // Firestore tetap nyangkut walau parent/guru itu baru aja di-unlink/dikosongkan
    // relasinya. Akibatnya rules `isTeacherOfParent`/`isParentOfTeacherClass` bisa
    // masih menganggap relasi itu ada berdasarkan data basi, membocorkan push token
    // ke pihak yang harusnya udah gak relevan. Sekarang eksplisit deleteField()
    // kalau arraynya kosong, biar field-nya beneran kehapus dari dokumen.
    if (user.role === 'parent') {
      tokenPayload.studentIds =
        user.studentIds && user.studentIds.length > 0 ? user.studentIds : deleteField();
    }

    if (user.role === 'teacher') {
      tokenPayload.assignedClasses =
        user.classes && user.classes.length > 0 ? user.classes : deleteField();
    }

    await setDoc(tokenDocRef, tokenPayload, { merge: true });
    console.log(`[PushTokenService] Push Token berhasil terdaftar untuk ${user.email}`);

    return token;
  } catch (error: unknown) {
    console.error('[PushTokenService] Error saat meregister push token:', error);
    return null;
  }
}

/**
 * Menghapus dokumen push token dari Firestore saat pengguna logout.
 */
export async function unregisterPushTokenAsync(uid: string): Promise<void> {
  if (!uid) return;

  try {
    const tokenDocRef = doc(db, 'pushTokens', uid);
    await deleteDoc(tokenDocRef);
    console.log(`[PushTokenService] Push Token untuk UID ${uid} berhasil dihapus.`);
  } catch (error: unknown) {
    console.error('[PushTokenService] Error saat menghapus push token:', error);
  }
}
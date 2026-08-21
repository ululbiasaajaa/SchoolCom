import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
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

    // 3. Dapatkan Expo Push Token
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;

    if (!token) {
      console.warn('[PushTokenService] Gagal mendapatkan Expo Push Token string.');
      return null;
    }

    // 4. Simpan/Update Token ke Firestore Collection pushTokens/{uid}
    const tokenDocRef = doc(db, 'pushTokens', user.uid);
    const tokenPayload: PushTokenDocument = {
      pushToken: token,
      role: user.role,
      platform: Platform.OS,
      updatedAt: new Date().toISOString(),
    };

    // Sertakan metadata scoping untuk optimasi Security Rules O(1)
    if (user.role === 'parent' && user.studentIds && user.studentIds.length > 0) {
      tokenPayload.studentIds = user.studentIds;
    }

    // Menggunakan field user.classes sesuai interface User di types/schoolcom.ts
    if (user.role === 'teacher' && user.classes && user.classes.length > 0) {
      tokenPayload.assignedClasses = user.classes;
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
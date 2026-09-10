import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
// @ts-expect-error - getReactNativePersistence ada di runtime RN build, tapi tidak ada di type defs default firebase/auth
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// FIX: Validasi eksplisit — kalau ada env var yang lupa di-set (misal pas build EAS),
// gagal cepat dengan pesan jelas daripada initializeApp() jalan dengan config setengah kosong
// dan errornya baru muncul belakangan dengan pesan yang membingungkan.
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  throw new Error(
    `[firebase.ts] Konfigurasi Firebase tidak lengkap. Env var berikut kosong/tidak terbaca: ${missingKeys.join(', ')}. ` +
      'Pastikan semua EXPO_PUBLIC_FIREBASE_* sudah di-set di .env / EAS secrets.'
  );
}

// Inisialisasi Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// FIX: initializeAuth cuma boleh dipanggil SEKALI per app instance.
// Kalau module ini ke-import ulang (Fast Refresh di dev, atau ada entry point ganda),
// initializeAuth bakal throw "Auth has already been initialized". Guard dengan try/catch
// dan fallback ke getAuth(app) yang mengembalikan instance Auth yang sudah ada.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };

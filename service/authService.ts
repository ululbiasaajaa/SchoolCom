import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    User
} from 'firebase/auth';
import { auth } from '../config/firebase';

/**
 * Melakukan login pengguna menggunakan Email dan Password
 */
export const loginWithEmail = async (email: string, pass: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    return userCredential.user;
  } catch (error: any) {
    console.error('Error logging in:', error);
    throw error;
  }
};

/**
 * Melakukan logout pengguna dari sesi Firebase Auth
 */
export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Error logging out:', error);
    throw error;
  }
};

/**
 * Listener Realtime Status Autentikasi
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};
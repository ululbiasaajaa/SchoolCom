import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { auth } from '../config/firebase';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const segments = useSegments();
  const router = useRouter();

  // 1. Listen status auth & restore session dari AsyncStorage
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (isInitializing) {
        setIsInitializing(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Navigation Guard / Protected Routes Logic
  useEffect(() => {
    if (isInitializing) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Jika belum/tidak login dan mencoba masuk ke protected route -> redirect ke login
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Jika sudah login tapi masih di layar login -> redirect ke dashboard
      router.replace('/(tabs)');
    }
  }, [user, segments, isInitializing]);

  // 3. Tampilkan Loading Splash Screen sederhana saat restore session
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Sentry from 'sentry-expo';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Toast } from '@/components/toast';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableInExpoDevelopment: false,
  debug: __DEV__,
});

SplashScreen.preventAutoHideAsync().catch(() => null);

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const firstSegment = segments[0];

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = firstSegment === '(auth)';
    const inAppGroup = firstSegment === '(app)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && !inAppGroup) {
      router.replace('/(app)');
    }
  }, [firstSegment, isLoading, router, session]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => null);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});

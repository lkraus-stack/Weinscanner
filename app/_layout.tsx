import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Toast } from '@/components/toast';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    debug: false,
    dsn: sentryDsn,
    enabled: !__DEV__,
  });
}

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
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <BottomSheetModalProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <Toast />
        </BottomSheetModalProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  root: {
    flex: 1,
  },
});

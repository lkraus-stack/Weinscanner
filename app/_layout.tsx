import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Sentry from '@sentry/react-native';
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Toast } from '@/components/toast';
import { useAuth } from '@/hooks/useAuth';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

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

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <ThemedRootContent />
          </BottomSheetModalProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function ThemedRootContent() {
  const { isLoading, isPasswordRecovery, session, user } = useAuth();
  const { colors, resolved } = useTheme();
  const queryClient = useQueryClient();
  const router = useRouter();
  const segments = useSegments();
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  const firstSegment = segments[0];
  const activeRoute = segments[1];
  const statusBarStyle = resolved === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const currentUserId = user?.id ?? null;
    const previousUserId = previousUserIdRef.current;

    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      queryClient.clear();
    }

    if (user) {
      Sentry.setUser({
        email: user.email ?? undefined,
        id: user.id,
      });
    } else {
      Sentry.setUser(null);
    }

    previousUserIdRef.current = currentUserId;
  }, [isLoading, queryClient, user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = firstSegment === '(auth)';
    const inAppGroup = firstSegment === '(app)';
    const inAuthCallback =
      firstSegment === 'auth' && activeRoute === 'callback';
    const inAuthRoute = inAuthGroup || inAuthCallback;
    const inResetPassword = inAuthGroup && activeRoute === 'reset-password';

    if (session && isPasswordRecovery) {
      if (!inResetPassword) {
        router.replace('/(auth)/reset-password');
      }

      return;
    }

    if (!session && !inAuthRoute) {
      router.replace('/(auth)/login');
    } else if (session && !inAppGroup) {
      router.replace('/(app)');
    }
  }, [activeRoute, firstSegment, isLoading, isPasswordRecovery, router, session]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => null);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <View
          style={[
            styles.loadingScreen,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  root: {
    flex: 1,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sentry from 'sentry-expo';

import { EmptyState } from '@/components/empty-state';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const email = user?.email ?? 'unbekannte E-Mail';

  async function handleSignOut() {
    try {
      setIsSigningOut(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      Alert.alert('Logout fehlgeschlagen', getErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  }

  function handleSentryTest() {
    Sentry.Native.captureException(new Error('Sentry Test'));
    Alert.alert(
      'Sentry-Test gesendet',
      'Wenn ein echter DSN gesetzt ist, sollte der Fehler gleich im Dashboard erscheinen.',
    );
  }

  return (
    <View style={styles.screen}>
      <EmptyState
        icon="person-circle-outline"
        title="Profil"
        description={`Angemeldet als ${email}. Einstellungen und Statistiken folgen in Sprint 14.`}
        cta={{
          label: 'Logout',
          onPress: handleSignOut,
          isLoading: isSigningOut,
        }}
      />

      {__DEV__ ? (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.sentryButton,
            pressed && styles.sentryButtonPressed,
          ]}
          onPress={handleSentryTest}
        >
          <Ionicons name="bug-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.sentryButtonText}>
            Sentry Test-Fehler senden
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.xl,
    justifyContent: 'center',
  },
  sentryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  sentryButtonPressed: {
    opacity: 0.74,
  },
  sentryButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
    letterSpacing: 0,
  },
});

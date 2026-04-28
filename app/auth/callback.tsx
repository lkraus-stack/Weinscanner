import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuthStore } from '@/stores/auth-store';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { colors, styles } = useAuthCallbackStyles();
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
  const session = useAuthStore((state) => state.session);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    router.replace(isPasswordRecovery ? '/(auth)/reset-password' : '/(app)');

    return undefined;
  }, [isPasswordRecovery, router, session]);

  useEffect(() => {
    if (session) {
      return undefined;
    }

    const timeout = setTimeout(() => setShowFallback(true), 6000);

    return () => clearTimeout(timeout);
  }, [session]);

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.title}>Login wird abgeschlossen</Text>
        <Text style={styles.description}>
          Einen Moment, wir öffnen deinen Wine-Scanner-Account.
        </Text>

        {showFallback ? (
          <>
            <Text style={styles.errorText}>
              Falls nichts passiert ist, öffne den Login-Link bitte noch einmal.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(auth)/login')}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Zurück zum Login</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

function useAuthCallbackStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { colors, styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      minHeight: 50,
      paddingHorizontal: spacing.lg,
    },
    buttonText: {
      color: colors.white,
      fontSize: typography.size.base,
      fontWeight: typography.weight.extraBold,
    },
    description: {
      color: colors.textSecondary,
      fontSize: typography.size.base,
      lineHeight: typography.lineHeight.base,
      textAlign: 'center',
    },
    errorText: {
      color: colors.primaryDark,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
      textAlign: 'center',
    },
    panel: {
      alignItems: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing.screenX,
    },
    screen: {
      alignItems: 'center',
      backgroundColor: colors.background,
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
      textAlign: 'center',
    },
  });
}

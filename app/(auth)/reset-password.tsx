import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors, resolved, styles } = useResetPasswordStyles();
  const clearPasswordRecovery = useAuthStore(
    (state) => state.clearPasswordRecovery
  );
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
  const user = useAuthStore((state) => state.user);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canSave =
    Boolean(user) &&
    isPasswordRecovery &&
    password.length >= 6 &&
    password === passwordConfirmation &&
    !isSaving;

  async function savePassword() {
    if (!user || !isPasswordRecovery) {
      setErrorMessage('Der Reset-Link ist nicht mehr aktiv.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Das Passwort braucht mindestens 6 Zeichen.');
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage('Die Passwörter stimmen nicht überein.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      clearPasswordRecovery();
      router.replace('/(app)');
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function goToLogin() {
    clearPasswordRecovery();
    router.replace('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>Neues Passwort</Text>
          <Text style={styles.subtitle}>
            Vergib ein neues Passwort für deinen Wine-Scanner-Account.
          </Text>
        </View>

        <View style={styles.panel}>
          {!user || !isPasswordRecovery ? (
            <>
              <Text style={styles.errorText}>
                Der Link ist abgelaufen oder wurde bereits verwendet.
              </Text>
              <Pressable onPress={goToLogin} style={styles.button}>
                <Text style={styles.buttonText}>Zurück zum Login</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Neues Passwort</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect={false}
                  keyboardAppearance={resolved}
                  onChangeText={setPassword}
                  onSubmitEditing={savePassword}
                  placeholder="Mindestens 6 Zeichen"
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="next"
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={password}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Passwort wiederholen</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect={false}
                  keyboardAppearance={resolved}
                  onChangeText={setPasswordConfirmation}
                  onSubmitEditing={savePassword}
                  placeholder="Noch einmal eingeben"
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="done"
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={passwordConfirmation}
                />
              </View>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              <Pressable
                disabled={!canSave}
                onPress={savePassword}
                style={[styles.button, !canSave && styles.buttonDisabled]}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Passwort speichern</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function useResetPasswordStyles() {
  const { colors, resolved } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { colors, resolved, styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    brand: {
      color: colors.text,
      fontSize: typography.size.brand,
      fontWeight: typography.weight.black,
      letterSpacing: 0,
    },
    button: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      minHeight: 54,
      paddingHorizontal: spacing.lg + 2,
    },
    buttonDisabled: {
      opacity: 0.45,
    },
    buttonText: {
      color: colors.white,
      fontSize: typography.size.base,
      fontWeight: typography.weight.extraBold,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.screenX,
      paddingVertical: spacing.screenY,
    },
    errorText: {
      color: colors.error,
      fontSize: typography.size.md,
      lineHeight: typography.lineHeight.md,
    },
    fieldGroup: {
      gap: spacing.sm,
    },
    header: {
      gap: spacing.sm + 2,
      marginBottom: spacing.xxxl,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.base,
      minHeight: 54,
      paddingHorizontal: spacing.lg,
    },
    label: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    panel: {
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.xxl - 2,
      padding: spacing.xl,
    },
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.size.base,
      lineHeight: typography.lineHeight.base,
    },
  });
}

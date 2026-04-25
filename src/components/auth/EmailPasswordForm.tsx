import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

export function EmailPasswordForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit =
    normalizedEmail.includes('@') && password.length >= 6 && !isSigningIn && !isSigningUp;

  async function signIn() {
    if (!canSubmit) {
      setErrorMessage('Bitte gib E-Mail und Passwort ein.');
      return;
    }

    try {
      setIsSigningIn(true);
      setMessage(null);
      setErrorMessage(null);

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSigningIn(false);
    }
  }

  async function signUp() {
    if (!canSubmit) {
      setErrorMessage('Das Passwort braucht mindestens 6 Zeichen.');
      return;
    }

    try {
      setIsSigningUp(true);
      setMessage(null);
      setErrorMessage(null);

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        setMessage(
          'Account erstellt. Falls Supabase eine Bestätigung verlangt, prüfe bitte dein Postfach.'
        );
      }
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSigningUp(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>E-Mail</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="deine@email.de"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          inputMode="email"
          keyboardType="email-address"
          returnKeyType="next"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Passwort</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Mindestens 6 Zeichen"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          secureTextEntry
          textContentType="password"
          onSubmitEditing={signIn}
        />
      </View>

      {message ? <Text style={styles.messageText}>{message}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={signIn}
        disabled={!canSubmit}
      >
        {isSigningIn ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Einloggen</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, !canSubmit && styles.buttonDisabled]}
        onPress={signUp}
        disabled={!canSubmit}
      >
        {isSigningUp ? (
          <ActivityIndicator color={colors.primaryDark} />
        ) : (
          <Text style={styles.secondaryButtonText}>Account erstellen</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
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
  messageText: {
    color: colors.success,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg + 2,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
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
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
});

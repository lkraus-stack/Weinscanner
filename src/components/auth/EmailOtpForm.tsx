import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const LOGIN_LINK_REDIRECT_URL = 'winescanner://auth/callback';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

export function EmailOtpForm() {
  const { colors, resolved, styles } = useEmailOtpFormStyles();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [hasSentLink, setHasSentLink] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const canSendLink = normalizedEmail.includes('@') && !isSendingLink;

  async function sendLoginLink() {
    if (!normalizedEmail.includes('@')) {
      setErrorMessage('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    try {
      setIsSendingLink(true);
      setMessage(null);
      setErrorMessage(null);

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: LOGIN_LINK_REDIRECT_URL,
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }

      setHasSentLink(true);
      setMessage(
        'Wir haben dir einen Login-Link gesendet. Öffne die Mail auf diesem iPhone.'
      );
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSendingLink(false);
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
          editable={!isSendingLink}
          inputMode="email"
          keyboardType="email-address"
          keyboardAppearance={resolved}
          returnKeyType="send"
          textContentType="username"
          onSubmitEditing={sendLoginLink}
        />
      </View>

      {message ? <Text style={styles.messageText}>{message}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.button, !canSendLink && styles.buttonDisabled]}
        onPress={sendLoginLink}
        disabled={!canSendLink}
      >
        {isSendingLink ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>
            {hasSentLink ? 'Login-Link erneut senden' : 'Login-Link senden'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function useEmailOtpFormStyles() {
  const { colors, resolved } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { colors, resolved, styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  errorText: {
    color: colors.error,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  messageText: {
    color: colors.success,
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
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  });
}

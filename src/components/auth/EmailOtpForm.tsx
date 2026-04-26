import { useMemo, useRef, useState } from 'react';
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

type Step = 'email' | 'code';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

export function EmailOtpForm() {
  const { colors, resolved, styles } = useEmailOtpFormStyles();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const codeInputRef = useRef<TextInput>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const canSendCode = normalizedEmail.includes('@') && !isSendingCode;
  const canVerifyCode = code.length === 6 && !isVerifyingCode;

  async function sendCode() {
    if (!normalizedEmail.includes('@')) {
      setErrorMessage('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    try {
      setIsSendingCode(true);
      setErrorMessage(null);

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }

      setStep('code');
      setCode('');
      requestAnimationFrame(() => codeInputRef.current?.focus());
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSendingCode(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6) {
      setErrorMessage('Bitte gib den 6-stelligen Code ein.');
      return;
    }

    try {
      setIsVerifyingCode(true);
      setErrorMessage(null);

      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code,
        type: 'email',
      });

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsVerifyingCode(false);
    }
  }

  function handleCodeChange(nextCode: string) {
    setCode(nextCode.replace(/\D/g, '').slice(0, 6));
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
          editable={step === 'email' && !isSendingCode}
          inputMode="email"
          keyboardType="email-address"
          keyboardAppearance={resolved}
          returnKeyType="send"
          onSubmitEditing={sendCode}
        />
      </View>

      {step === 'code' ? (
        <View style={styles.fieldGroup}>
          <View style={styles.codeHeader}>
            <Text style={styles.label}>Code</Text>
            <Pressable onPress={sendCode} disabled={isSendingCode}>
              <Text style={styles.linkText}>
                {isSendingCode ? 'Wird gesendet...' : 'Code erneut senden'}
              </Text>
            </Pressable>
          </View>
          <TextInput
            ref={codeInputRef}
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={handleCodeChange}
            placeholder="123456"
            placeholderTextColor={colors.placeholder}
            autoFocus
            inputMode="numeric"
            keyboardType="number-pad"
            keyboardAppearance={resolved}
            maxLength={6}
            returnKeyType="done"
            textContentType="oneTimeCode"
            onSubmitEditing={verifyCode}
          />
          <Text style={styles.hintText}>
            Gib den 6-stelligen Code aus deiner E-Mail ein.
          </Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {step === 'email' ? (
        <Pressable
          style={[styles.button, !canSendCode && styles.buttonDisabled]}
          onPress={sendCode}
          disabled={!canSendCode}
        >
          {isSendingCode ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Code senden</Text>
          )}
        </Pressable>
      ) : (
        <Pressable
          style={[styles.button, !canVerifyCode && styles.buttonDisabled]}
          onPress={verifyCode}
          disabled={!canVerifyCode}
        >
          {isVerifyingCode ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Einloggen</Text>
          )}
        </Pressable>
      )}
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
  codeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeInput: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    letterSpacing: 0,
    textAlign: 'center',
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  linkText: {
    color: colors.primaryDark,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
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

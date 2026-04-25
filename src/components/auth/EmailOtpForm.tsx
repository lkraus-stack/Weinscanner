import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

type Step = 'email' | 'code';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

export function EmailOtpForm() {
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
          placeholderTextColor="#8A8178"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={step === 'email' && !isSendingCode}
          inputMode="email"
          keyboardType="email-address"
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
            placeholderTextColor="#8A8178"
            autoFocus
            inputMode="numeric"
            keyboardType="number-pad"
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
            <ActivityIndicator color="#FFFFFF" />
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
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Einloggen</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E0D5',
    borderRadius: 12,
    borderWidth: 1,
    color: '#1A1A1A',
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  codeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
  },
  hintText: {
    color: '#6B6B6B',
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    lineHeight: 20,
  },
  linkText: {
    color: '#8B3A2A',
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#B85C4A',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

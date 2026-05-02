import * as Sentry from '@sentry/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ensureProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code);
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

function getFormattedFullName(
  fullName: AppleAuthentication.AppleAuthenticationCredential['fullName']
) {
  if (!fullName) {
    return null;
  }

  try {
    const formattedName = AppleAuthentication.formatFullName(
      fullName,
      'default'
    ).trim();

    if (formattedName) {
      return formattedName;
    }
  } catch {
    // Some non-device runtimes can miss the native formatter.
  }

  const fallbackName = [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fallbackName || null;
}

async function saveAppleProfileMetadata(
  credential: AppleAuthentication.AppleAuthenticationCredential
) {
  const fullName = getFormattedFullName(credential.fullName);

  if (
    !fullName &&
    !credential.fullName?.givenName &&
    !credential.fullName?.familyName
  ) {
    return;
  }

  const metadata: Record<string, string> = {};

  if (fullName) {
    metadata.full_name = fullName;
  }

  if (credential.fullName?.givenName) {
    metadata.given_name = credential.fullName.givenName;
  }

  if (credential.fullName?.familyName) {
    metadata.family_name = credential.fullName.familyName;
  }

  const { error } = await supabase.auth.updateUser({
    data: metadata,
  });

  if (error) {
    throw error;
  }
}

export function AppleSignInButton() {
  const { resolved } = useTheme();
  const [isAvailable, setIsAvailable] = useState(false);
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (!isMounted) return;

        setIsAvailable(available);
      })
      .catch(() => {
        if (!isMounted) return;

        setIsAvailable(false);
      })
      .finally(() => {
        if (!isMounted) return;

        setHasCheckedAvailability(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!hasCheckedAvailability || !isAvailable) {
    return null;
  }

  async function handlePress() {
    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple hat keinen Login-Token zurückgegeben.');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        throw error;
      }

      await saveAppleProfileMetadata(credential);
      await ensureProfile();
    } catch (error: unknown) {
      if (getErrorCode(error) === 'ERR_REQUEST_CANCELED') {
        return;
      }

      Sentry.captureException(error, {
        tags: {
          auth_provider: 'apple',
        },
      });
      Alert.alert('Apple Login fehlgeschlagen', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container} pointerEvents={isLoading ? 'none' : 'auto'}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={
          resolved === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={12}
        style={styles.button}
        onPress={handlePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    opacity: 1,
  },
  button: {
    height: 56,
    width: '100%',
  },
});

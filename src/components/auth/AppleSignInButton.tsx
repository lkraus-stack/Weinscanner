import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

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

export function AppleSignInButton() {
  const { resolved } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  if (Platform.OS !== 'ios') {
    return null;
  }

  async function handlePress() {
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
    } catch (error: unknown) {
      if (getErrorCode(error) === 'ERR_REQUEST_CANCELED') {
        return;
      }

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

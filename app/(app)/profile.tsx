import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme/colors';

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});

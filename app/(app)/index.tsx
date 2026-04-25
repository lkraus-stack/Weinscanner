import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

export default function AppHomeScreen() {
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
      <View style={styles.content}>
        <Text style={styles.kicker}>Angemeldet</Text>
        <Text style={styles.title}>Eingeloggt als {email}</Text>
        <Text style={styles.description}>
          Der geschützte Bereich ist erreichbar. Die Tab-Navigation folgt in
          Sprint 04.
        </Text>

        <Pressable
          style={[styles.logoutButton, isSigningOut && styles.logoutButtonBusy]}
          onPress={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.logoutButtonText}>Logout</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#FAF7F2',
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  kicker: {
    color: '#8B3A2A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1A1A1A',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 32,
  },
  description: {
    color: '#6B6B6B',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 12,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#B85C4A',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 28,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  logoutButtonBusy: {
    opacity: 0.7,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});

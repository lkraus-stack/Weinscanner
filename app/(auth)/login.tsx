import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';

export default function LoginScreen() {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>Wine Scanner</Text>
          <Text style={styles.subtitle}>
            Scanne, merke und bewerte deine Weine.
          </Text>
        </View>

        <View style={styles.panel}>
          <AppleSignInButton />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>oder</Text>
            <View style={styles.divider} />
          </View>

          <EmailOtpForm />
        </View>
      </View>
    </KeyboardAvoidingView>
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
  header: {
    gap: 10,
    marginBottom: 32,
  },
  brand: {
    color: '#1A1A1A',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#6B6B6B',
    fontSize: 16,
    lineHeight: 23,
  },
  panel: {
    backgroundColor: '#FFFDF9',
    borderColor: '#E5E0D5',
    borderRadius: 16,
    borderWidth: 1,
    gap: 22,
    padding: 20,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  divider: {
    backgroundColor: '#E5E0D5',
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: '#6B6B6B',
    fontSize: 13,
    fontWeight: '700',
  },
});

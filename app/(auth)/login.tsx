import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';
import { EmailPasswordForm } from '@/components/auth/EmailPasswordForm';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type LoginMode = 'password' | 'code';

export default function LoginScreen() {
  const [loginMode, setLoginMode] = useState<LoginMode>('password');

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

          <View style={styles.segmentedControl}>
            <Pressable
              style={[
                styles.segmentButton,
                loginMode === 'password' && styles.segmentButtonActive,
              ]}
              onPress={() => setLoginMode('password')}
            >
              <Text
                style={[
                  styles.segmentText,
                  loginMode === 'password' && styles.segmentTextActive,
                ]}
              >
                Passwort
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.segmentButton,
                loginMode === 'code' && styles.segmentButtonActive,
              ]}
              onPress={() => setLoginMode('code')}
            >
              <Text
                style={[
                  styles.segmentText,
                  loginMode === 'code' && styles.segmentTextActive,
                ]}
              >
                Code
              </Text>
            </Pressable>
          </View>

          {loginMode === 'password' ? <EmailPasswordForm /> : <EmailOtpForm />}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.screenY,
  },
  header: {
    gap: spacing.sm + 2,
    marginBottom: spacing.xxxl,
  },
  brand: {
    color: colors.text,
    fontSize: typography.size.brand,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  panel: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xxl - 2,
    padding: spacing.xl,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  divider: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  segmentedControl: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  segmentTextActive: {
    color: colors.white,
  },
});

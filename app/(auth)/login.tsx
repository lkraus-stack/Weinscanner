import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

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
});

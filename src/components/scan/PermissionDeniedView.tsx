import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type PermissionDeniedViewProps = {
  canAskAgain: boolean;
  onOpenSettings: () => void;
  onRequestPermission: () => void;
};

export function PermissionDeniedView({
  canAskAgain,
  onOpenSettings,
  onRequestPermission,
}: PermissionDeniedViewProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.iconShell}>
        <Ionicons
          name="camera-outline"
          size={34}
          color={colors.primaryDark}
        />
      </View>

      <Text style={styles.title}>Kamera nicht freigegeben</Text>
      <Text style={styles.description}>
        Wir brauchen Zugriff auf deine Kamera, um Weinetiketten zu scannen.
      </Text>

      {canAskAgain ? (
        <Pressable style={styles.primaryButton} onPress={onRequestPermission}>
          <Text style={styles.primaryButtonText}>Kamera freigeben</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.lockedText}>
            Du hast den Zugriff dauerhaft verweigert. Du kannst ihn in den
            iOS-Einstellungen wieder aktivieren.
          </Text>
          <Pressable style={styles.primaryButton} onPress={onOpenSettings}>
            <Text style={styles.primaryButtonText}>Einstellungen öffnen</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    marginBottom: spacing.xxl,
    width: 88,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
    lineHeight: typography.lineHeight.xl,
    textAlign: 'center',
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    marginTop: spacing.sm,
    maxWidth: 320,
    textAlign: 'center',
  },
  lockedText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    marginTop: spacing.xxl,
    maxWidth: 320,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    marginTop: spacing.xxl,
    minHeight: 54,
    minWidth: 190,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
});

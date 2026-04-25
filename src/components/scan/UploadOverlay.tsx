import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type UploadOverlayProps = {
  onCancel: () => void;
  text?: string;
  visible: boolean;
};

export function UploadOverlay({
  onCancel,
  text = 'Foto wird hochgeladen...',
  visible,
}: UploadOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.backdrop} />
      <View style={styles.panel}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.text}>{text}</Text>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Abbrechen</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
    opacity: 0.68,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  cancelText: {
    color: colors.primaryDark,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screenX,
    zIndex: 20,
  },
  panel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.lg,
    padding: spacing.xxl,
    shadowColor: colors.shadow,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    width: '100%',
  },
  text: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.base,
    textAlign: 'center',
  },
});

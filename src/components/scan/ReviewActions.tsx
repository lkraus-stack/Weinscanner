import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type ReviewActionsProps = {
  disabled?: boolean;
  isUploading?: boolean;
  onCrop: () => void;
  onRetake: () => void;
  onUpload: () => void;
};

export function ReviewActions({
  disabled,
  isUploading,
  onCrop,
  onRetake,
  onUpload,
}: ReviewActionsProps) {
  return (
    <View style={styles.container}>
      <Pressable
        disabled={disabled || isUploading}
        onPress={onRetake}
        style={styles.textButton}
      >
        <Text style={styles.textButtonLabel}>Erneut aufnehmen</Text>
      </Pressable>

      <Pressable
        disabled={disabled || isUploading}
        onPress={onCrop}
        style={styles.textButton}
      >
        <Text style={styles.textButtonLabel}>Bearbeiten</Text>
      </Pressable>

      <Pressable
        disabled={disabled || isUploading}
        onPress={onUpload}
        style={[styles.primaryButton, (disabled || isUploading) && styles.disabled]}
      >
        {isUploading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryButtonLabel}>Analysieren</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  disabled: {
    opacity: 0.45,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonLabel: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  textButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  textButtonLabel: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
});

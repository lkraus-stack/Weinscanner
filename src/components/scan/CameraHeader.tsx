import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type CameraHeaderProps = {
  flashMode: 'auto' | 'on' | 'off';
  onClose: () => void;
  onToggleFlash: () => void;
  topInset: number;
};

const FLASH_LABELS = {
  auto: 'Auto',
  off: 'Aus',
  on: 'An',
} as const;

export function CameraHeader({
  flashMode,
  onClose,
  onToggleFlash,
  topInset,
}: CameraHeaderProps) {
  return (
    <View style={[styles.container, { paddingTop: topInset + spacing.md }]}>
      <Pressable
        accessibilityLabel="Scanner schließen"
        onPress={onClose}
        style={styles.iconButton}
      >
        <Ionicons name="close" size={26} color={colors.white} />
      </Pressable>

      <Pressable
        accessibilityLabel={`Blitz ${FLASH_LABELS[flashMode]}`}
        onPress={onToggleFlash}
        style={styles.flashButton}
      >
        <Ionicons name="flash-outline" size={18} color={colors.white} />
        <Text style={styles.flashText}>{FLASH_LABELS[flashMode]}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: spacing.xxl,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    opacity: 0.82,
    width: 46,
  },
  flashButton: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 46,
    opacity: 0.82,
    paddingHorizontal: spacing.md,
  },
  flashText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
});

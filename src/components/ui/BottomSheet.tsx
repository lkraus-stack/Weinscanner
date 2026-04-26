import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const DEFAULT_SNAP_POINTS = ['50%'];

type BottomSheetProps = {
  children: React.ReactNode;
  description?: string;
  onClose: () => void;
  snapPoints?: (number | string)[];
  title?: string;
  visible: boolean;
};

type SheetOptionProps = {
  destructive?: boolean;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  isBusy?: boolean;
  label: string;
  onPress: () => void;
  selected?: boolean;
};

export function BottomSheet({
  children,
  description,
  onClose,
  snapPoints = DEFAULT_SNAP_POINTS,
  title,
  visible,
}: BottomSheetProps) {
  const { styles } = useBottomSheetStyles();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const resolvedSnapPoints = useMemo(() => snapPoints, [snapPoints]);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      return;
    }

    bottomSheetRef.current?.dismiss();
  }, [visible]);

  const handleDismiss = useCallback(() => {
    if (visible) {
      onClose();
    }
  }, [onClose, visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleIndicatorStyle={styles.handle}
      index={0}
      onDismiss={handleDismiss}
      ref={bottomSheetRef}
      snapPoints={resolvedSnapPoints}
    >
      <BottomSheetView style={styles.content}>
        {title ? (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {description ? (
              <Text style={styles.description}>{description}</Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.options}>{children}</View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

export function SheetOption({
  destructive = false,
  disabled = false,
  icon,
  isBusy = false,
  label,
  onPress,
  selected = false,
}: SheetOptionProps) {
  const { colors, styles } = useBottomSheetStyles();
  const inactive = disabled || isBusy;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
        inactive && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.optionIcon,
          destructive && styles.optionIconDestructive,
          selected && styles.optionIconSelected,
        ]}
      >
        <Ionicons
          color={
            destructive
              ? colors.error
              : selected
                ? colors.white
                : colors.primaryDark
          }
          name={icon}
          size={20}
        />
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.optionText,
          destructive && styles.optionTextDestructive,
        ]}
      >
        {label}
      </Text>

      {isBusy ? (
        <ActivityIndicator color={destructive ? colors.error : colors.primary} />
      ) : null}
    </Pressable>
  );
}

function useBottomSheetStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { colors, styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  disabled: {
    opacity: 0.55,
  },
  handle: {
    backgroundColor: colors.border,
    width: 48,
  },
  header: {
    gap: spacing.sm,
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  optionIconDestructive: {
    backgroundColor: colors.surface,
  },
  optionIconSelected: {
    backgroundColor: colors.primary,
  },
  options: {
    gap: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  optionTextDestructive: {
    color: colors.error,
  },
  pressed: {
    opacity: 0.78,
  },
  sheetBackground: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.lg,
  },
  });
}

import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const FRAME_WIDTH_RATIO = 0.7;
const FRAME_ASPECT_RATIO = 4 / 5;

type CameraOverlayProps = {
  hint?: string;
};

export function CameraOverlay({
  hint = 'Etikett im Rahmen ausrichten',
}: CameraOverlayProps) {
  const { styles } = useCameraOverlayStyles();
  const { width } = useWindowDimensions();
  const frameWidth = width * FRAME_WIDTH_RATIO;
  const frameHeight = frameWidth / FRAME_ASPECT_RATIO;

  return (
    <View pointerEvents="none" style={styles.container}>
      <View
        style={[
          styles.frame,
          {
            height: frameHeight,
            width: frameWidth,
          },
        ]}
      />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

function useCameraOverlayStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    ...StyleSheet.absoluteFillObject,
  },
  frame: {
    borderColor: colors.white,
    borderRadius: radii.sm,
    borderWidth: 2,
    shadowColor: colors.text,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
  },
  hint: {
    color: colors.surface,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    marginTop: spacing.md,
    opacity: 0.86,
    textAlign: 'center',
  },
  });
}

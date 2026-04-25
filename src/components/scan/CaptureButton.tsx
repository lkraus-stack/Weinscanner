import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radii } from '@/theme/spacing';

type CaptureButtonProps = {
  disabled?: boolean;
  isLoading?: boolean;
  onPress: () => void;
};

export function CaptureButton({
  disabled,
  isLoading,
  onPress,
}: CaptureButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Foto aufnehmen"
      disabled={disabled}
      onPress={onPress}
      style={[styles.outer, disabled && styles.disabled]}
    >
      <View style={styles.inner}>
        {isLoading ? <ActivityIndicator color={colors.text} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  inner: {
    alignItems: 'center',
    borderColor: colors.text,
    borderRadius: radii.pill,
    borderWidth: 3,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  disabled: {
    opacity: 0.5,
  },
});

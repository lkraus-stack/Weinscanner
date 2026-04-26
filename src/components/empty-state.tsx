import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type EmptyStateCta = {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
};

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  cta?: EmptyStateCta;
};

export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconShell}>
        <Ionicons name={icon} size={34} color={colors.primaryDark} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {cta ? (
        <Pressable
          style={[styles.button, cta.isLoading && styles.buttonBusy]}
          onPress={cta.onPress}
          disabled={cta.isLoading}
        >
          {cta.isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>{cta.label}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xxl,
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
    width: 88,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.sm,
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
    maxWidth: 320,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 54,
    minWidth: 172,
    paddingHorizontal: spacing.xl,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
});

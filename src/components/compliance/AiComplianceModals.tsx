import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

type ModalProps = {
  isOpen: boolean;
  isSaving?: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function AgeGateModal({
  isOpen,
  isSaving = false,
  onAccept,
  onDecline,
}: ModalProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDecline}
      statusBarTranslucent
      transparent
      visible={isOpen}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Ionicons color={colors.primary} name="wine-outline" size={24} />
          </View>
          <Text style={styles.title}>Altersfreigabe</Text>
          <Text style={styles.body}>
            Wine Scanner richtet sich an erwachsene Nutzer. Bitte bestätige,
            dass du mindestens 18 Jahre alt bist.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Altersfreigabe abbrechen"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onDecline}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Mindestalter bestätigen"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onAccept}
              style={styles.primaryButton}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Bestätigen</Text>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function AiConsentModal({
  isOpen,
  isSaving = false,
  onAccept,
  onDecline,
}: ModalProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDecline}
      statusBarTranslucent
      transparent
      visible={isOpen}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Ionicons color={colors.primary} name="sparkles-outline" size={24} />
          </View>
          <Text style={styles.title}>KI-Freigabe</Text>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.body}>
              Für KI-Funktionen sendet Wine Scanner die nötigen Eingaben an
              Server von Wine Scanner und an Vantero. Bei Restaurant Discovery
              können außerdem Google Places und Google Maps Standort- und
              Restaurantdaten verarbeiten.
            </Text>
            <Text style={styles.body}>
              Dazu gehören zum Beispiel temporäre Bild-URLs für Etikett-Scans,
              Restaurantdaten, Suchumkreis, Anlass und technische
              Verbindungsdaten. Deine Zustimmung gilt nur für die aktuellen
              Provider. Neue KI- oder Datenanbieter brauchen eine neue Prüfung.
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="KI-Freigabe ablehnen"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onDecline}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Nicht jetzt</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="KI-Freigabe erteilen"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onAccept}
              style={styles.primaryButton}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Einverstanden</Text>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    body: {
      color: colors.textSecondary,
      fontSize: typography.size.md,
      lineHeight: 22,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      maxHeight: '86%',
      padding: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { height: 12, width: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      width: '100%',
    },
    iconBadge: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      height: 52,
      justifyContent: 'center',
      marginBottom: spacing.md,
      width: 52,
    },
    overlay: {
      alignItems: 'center',
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      flex: 1,
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    scrollContent: {
      gap: spacing.sm,
      paddingBottom: spacing.xs,
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceWarm,
      borderColor: colors.border,
      borderRadius: radii.pill,
      borderWidth: 1,
      flex: 1,
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    title: {
      color: colors.text,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.bold,
      lineHeight: typography.lineHeight.xl,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
  });
}

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = {
  email: string;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  visible: boolean;
};

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase('de-DE');
}

export function DeleteAccountModal({
  email,
  isDeleting = false,
  onClose,
  onConfirm,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const [confirmEmail, setConfirmEmail] = useState('');
  const canDelete = normalizeEmail(confirmEmail) === normalizeEmail(email);

  useEffect(() => {
    if (visible) {
      setConfirmEmail('');
    }
  }, [visible]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.xxl },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.warningIcon}>
              <Ionicons name="warning-outline" size={24} color={colors.error} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Account löschen</Text>
              <Text style={styles.description}>
                Dies löscht alle deine Daten unwiderruflich.
              </Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gib zur Bestätigung deine E-Mail ein</Text>
            <TextInput
              autoCapitalize="none"
              editable={!isDeleting}
              keyboardType="email-address"
              onChangeText={setConfirmEmail}
              placeholder={email}
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              value={confirmEmail}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canDelete || isDeleting}
            onPress={() => onConfirm(confirmEmail)}
            style={[
              styles.deleteButton,
              (!canDelete || isDeleting) && styles.disabled,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.deleteButtonText}>
                Account endgültig löschen
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isDeleting}
            onPress={onClose}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  deleteButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  disabled: {
    opacity: 0.45,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 4,
    width: 48,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.size.base,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  root: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
  },
  warningIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
});

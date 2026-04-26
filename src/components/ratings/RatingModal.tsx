import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

import {
  getTodayRatingDate,
  RatingForm,
  type RatingFormValue,
} from './RatingForm';

export type { RatingFormValue } from './RatingForm';

type Props = {
  initialValue: RatingFormValue;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (value: RatingFormValue) => void | Promise<void>;
  submitLabel?: string;
  visible: boolean;
  wineTitle: string;
};

export function createEmptyRatingFormValue(): RatingFormValue {
  return {
    drankAt: getTodayRatingDate(),
    notes: '',
    occasion: '',
    stars: 0,
  };
}

export function RatingModal({
  initialValue,
  isSaving = false,
  onClose,
  onSubmit,
  submitLabel = 'Speichern',
  visible,
  wineTitle,
}: Props) {
  const insets = useSafeAreaInsets();
  const [formValue, setFormValue] = useState<RatingFormValue>(initialValue);
  const saveDisabled = isSaving || formValue.stars === 0;

  useEffect(() => {
    if (visible) {
      setFormValue(initialValue);
    }
  }, [initialValue, visible]);

  async function submit() {
    if (saveDisabled) {
      return;
    }

    await onSubmit(formValue);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable
            accessibilityLabel="Bewertung schließen"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onClose}
            style={styles.headerIconButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Wein bewerten</Text>

          <Pressable
            accessibilityRole="button"
            disabled={saveDisabled}
            onPress={submit}
            style={[styles.saveButton, saveDisabled && styles.saveButtonDisabled]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>{submitLabel}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xxxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.wineTitle}>{wineTitle}</Text>
          <RatingForm
            disabled={isSaving}
            onChange={setFormValue}
            value={formValue}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxxl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerIconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: colors.text,
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    textAlign: 'center',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 96,
    paddingHorizontal: spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  wineTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.lg,
    textAlign: 'center',
  },
});

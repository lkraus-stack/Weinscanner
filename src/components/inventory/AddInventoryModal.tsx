import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

import { QuantityPicker } from './QuantityPicker';
import { StorageLocationPicker } from './StorageLocationPicker';

export type InventoryFormValue = {
  notes: string;
  purchasePrice: number | null;
  purchasedAt: string | null;
  quantity: number;
  storageLocation: string;
};

type Props = {
  initialValue: InventoryFormValue;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (value: InventoryFormValue) => void | Promise<void>;
  submitLabel?: string;
  visible: boolean;
  wineTitle: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const NOTES_MIN_HEIGHT = 96;
const NOTES_MAX_HEIGHT = typography.lineHeight.base * 5 + spacing.lg * 2;

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function dateFromInputValue(value: string | null) {
  if (!value) {
    return new Date();
  }

  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function formatDisplayDate(value: string | null) {
  return value ? DATE_FORMATTER.format(dateFromInputValue(value)) : 'Kein Datum';
}

function formatPriceInput(value: number | null) {
  if (typeof value !== 'number') {
    return '';
  }

  return value.toFixed(2).replace('.', ',');
}

function parsePriceInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue.replace(',', '.'));

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return Number.NaN;
  }

  return Number(parsedValue.toFixed(2));
}

export function getTodayInventoryDate() {
  return toDateInputValue(new Date());
}

export function createEmptyInventoryFormValue(): InventoryFormValue {
  return {
    notes: '',
    purchasePrice: null,
    purchasedAt: getTodayInventoryDate(),
    quantity: 1,
    storageLocation: '',
  };
}

export function AddInventoryModal({
  initialValue,
  isSaving = false,
  onClose,
  onSubmit,
  submitLabel = 'Zum Bestand hinzufügen',
  visible,
  wineTitle,
}: Props) {
  const insets = useSafeAreaInsets();
  const [formValue, setFormValue] = useState<InventoryFormValue>(initialValue);
  const [priceText, setPriceText] = useState(
    formatPriceInput(initialValue.purchasePrice)
  );
  const [notesHeight, setNotesHeight] = useState(NOTES_MIN_HEIGHT);
  const parsedPrice = useMemo(() => parsePriceInput(priceText), [priceText]);
  const priceInvalid = Number.isNaN(parsedPrice);
  const saveDisabled = isSaving || priceInvalid;

  useEffect(() => {
    if (visible) {
      setFormValue(initialValue);
      setPriceText(formatPriceInput(initialValue.purchasePrice));
      setNotesHeight(NOTES_MIN_HEIGHT);
    }
  }, [initialValue, visible]);

  function updateField<K extends keyof InventoryFormValue>(
    field: K,
    value: InventoryFormValue[K]
  ) {
    setFormValue((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  async function submit() {
    if (saveDisabled) {
      return;
    }

    await onSubmit({
      ...formValue,
      purchasePrice: parsedPrice,
    });
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
            accessibilityLabel="Bestand schließen"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onClose}
            style={styles.headerIconButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Zum Bestand</Text>

          <Pressable
            accessibilityRole="button"
            disabled={saveDisabled}
            onPress={submit}
            style={[styles.saveButton, saveDisabled && styles.saveButtonDisabled]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name="add" size={22} color={colors.white} />
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

          <FormSection title="Menge">
            <QuantityPicker
              disabled={isSaving}
              onChange={(quantity) => updateField('quantity', quantity)}
              value={formValue.quantity}
            />
          </FormSection>

          <FormSection title="Standort">
            <StorageLocationPicker
              disabled={isSaving}
              onChange={(storageLocation) =>
                updateField('storageLocation', storageLocation)
              }
              value={formValue.storageLocation}
            />
          </FormSection>

          <FormSection title="Kaufdatum">
            <DateInput
              disabled={isSaving}
              onChange={(purchasedAt) => updateField('purchasedAt', purchasedAt)}
              value={formValue.purchasedAt}
            />
          </FormSection>

          <FormSection title="Kaufpreis (optional)">
            <View style={styles.priceWrapper}>
              <TextInput
                editable={!isSaving}
                keyboardType="decimal-pad"
                onChangeText={setPriceText}
                placeholder="18,00"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, styles.priceInput]}
                value={priceText}
              />
              <Text style={styles.priceSuffix}>€</Text>
            </View>
            {priceInvalid ? (
              <Text style={styles.errorText}>Bitte gib einen gültigen Preis ein.</Text>
            ) : null}
          </FormSection>

          <FormSection title="Notizen (optional)">
            <TextInput
              editable={!isSaving}
              multiline
              onChangeText={(notes) => updateField('notes', notes)}
              onContentSizeChange={(event) => {
                setNotesHeight(
                  Math.min(
                    Math.max(
                      event.nativeEvent.contentSize.height,
                      NOTES_MIN_HEIGHT
                    ),
                    NOTES_MAX_HEIGHT
                  )
                );
              }}
              placeholder="Zum Beispiel Händler, Regal oder Trinkidee"
              placeholderTextColor={colors.placeholder}
              scrollEnabled={notesHeight >= NOTES_MAX_HEIGHT}
              style={[styles.input, styles.notesInput, { height: notesHeight }]}
              textAlignVertical="top"
              value={formValue.notes}
            />
          </FormSection>

          <Pressable
            accessibilityRole="button"
            disabled={saveDisabled}
            onPress={submit}
            style={[styles.primaryButton, saveDisabled && styles.saveButtonDisabled]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>{submitLabel}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DateInput({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: string | null) => void;
  value: string | null;
}) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS !== 'ios') {
      setIsPickerVisible(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    onChange(toDateInputValue(selectedDate));
  }

  return (
    <View style={styles.dateWrapper}>
      <Pressable
        accessibilityLabel="Kaufdatum auswählen"
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setIsPickerVisible((visible) => !visible)}
        style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
      >
        <Text style={styles.dateText}>{formatDisplayDate(value)}</Text>
        <Ionicons
          color={colors.primaryDark}
          name="calendar-outline"
          size={20}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => onChange(null)}
        style={styles.clearDateButton}
      >
        <Text style={styles.clearDateText}>Kein Datum</Text>
      </Pressable>

      {isPickerVisible ? (
        <DateTimePicker
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          mode="date"
          onChange={handleDateChange}
          value={dateFromInputValue(value)}
        />
      ) : null}
    </View>
  );
}

function FormSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionLine} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clearDateButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  clearDateText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  content: {
    gap: spacing.xxxl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  dateText: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  dateWrapper: {
    gap: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
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
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.size.base,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  notesInput: {
    lineHeight: typography.lineHeight.base,
    maxHeight: NOTES_MAX_HEIGHT,
    minHeight: NOTES_MIN_HEIGHT,
  },
  pressed: {
    opacity: 0.78,
  },
  priceInput: {
    flex: 1,
    paddingRight: 44,
  },
  priceSuffix: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    position: 'absolute',
    right: spacing.lg,
  },
  priceWrapper: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  sectionLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
  },
  wineTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.lg,
    textAlign: 'center',
  },
});

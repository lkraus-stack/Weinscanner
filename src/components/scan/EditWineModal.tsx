import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { TasteDryness, WineColor } from '@/types/wine-extraction';

export type WineEditData = {
  alcohol_percent: number | null;
  appellation: string | null;
  country: string | null;
  grape_variety: string | null;
  producer: string;
  region: string | null;
  taste_dryness: TasteDryness | null;
  wine_color: WineColor | null;
  wine_name: string;
};

type Props = {
  onClose: () => void;
  onSave: (value: WineEditData) => void;
  value: WineEditData;
  visible: boolean;
};

const COLOR_OPTIONS: { label: string; value: WineColor }[] = [
  { label: 'Weiss', value: 'weiss' },
  { label: 'Rot', value: 'rot' },
  { label: 'Rosé', value: 'rose' },
  { label: 'Schaum', value: 'schaum' },
  { label: 'Süss', value: 'suess' },
];

const DRYNESS_OPTIONS: { label: string; value: TasteDryness }[] = [
  { label: 'Trocken', value: 'trocken' },
  { label: 'Halbtrocken', value: 'halbtrocken' },
  { label: 'Lieblich', value: 'lieblich' },
  { label: 'Süss', value: 'suess' },
];

function textOrEmpty(value: string | null) {
  return value ?? '';
}

function normalizeText(value: string) {
  return value.trim() || null;
}

function parseAlcohol(value: string) {
  const normalized = value.replace(',', '.').trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

export function EditWineModal({ onClose, onSave, value, visible }: Props) {
  const [form, setForm] = useState<WineEditData>(value);
  const [alcoholText, setAlcoholText] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    setForm(value);
    setAlcoholText(
      value.alcohol_percent === null ? '' : String(value.alcohol_percent)
    );
  }, [value, visible]);

  function updateField<K extends keyof WineEditData>(
    field: K,
    fieldValue: WineEditData[K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: fieldValue,
    }));
  }

  function save() {
    onSave({
      ...form,
      alcohol_percent: parseAlcohol(alcoholText),
      appellation: normalizeText(textOrEmpty(form.appellation)),
      country: normalizeText(textOrEmpty(form.country)),
      grape_variety: normalizeText(textOrEmpty(form.grape_variety)),
      producer: form.producer.trim(),
      region: normalizeText(textOrEmpty(form.region)),
      wine_name: form.wine_name.trim(),
    });
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Schließen" onPress={onClose}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Wein bearbeiten</Text>
          <Pressable onPress={save} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Speichern</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Field
            label="Weingut"
            onChangeText={(text) => updateField('producer', text)}
            value={form.producer}
          />
          <Field
            label="Wein"
            onChangeText={(text) => updateField('wine_name', text)}
            value={form.wine_name}
          />
          <Field
            label="Region"
            onChangeText={(text) => updateField('region', text)}
            value={textOrEmpty(form.region)}
          />
          <Field
            label="Land"
            onChangeText={(text) => updateField('country', text)}
            value={textOrEmpty(form.country)}
          />
          <Field
            label="Appellation"
            onChangeText={(text) => updateField('appellation', text)}
            value={textOrEmpty(form.appellation)}
          />
          <Field
            label="Rebsorte"
            onChangeText={(text) => updateField('grape_variety', text)}
            value={textOrEmpty(form.grape_variety)}
          />

          <ChoiceGroup
            label="Farbe"
            onChange={(nextValue) => updateField('wine_color', nextValue)}
            options={COLOR_OPTIONS}
            value={form.wine_color}
          />
          <ChoiceGroup
            label="Geschmack"
            onChange={(nextValue) => updateField('taste_dryness', nextValue)}
            options={DRYNESS_OPTIONS}
            value={form.taste_dryness}
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Alkohol</Text>
            <TextInput
              inputMode="decimal"
              keyboardType="decimal-pad"
              onChangeText={setAlcoholText}
              placeholder="z.B. 13.5"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              value={alcoholText}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Field({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function ChoiceGroup<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T | null) => void;
  options: { label: string; value: T }[];
  value: T | null;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(selected ? null : option.value)}
              style={[styles.choice, selected && styles.choiceSelected]}
            >
              <Text
                style={[
                  styles.choiceText,
                  selected && styles.choiceTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  choiceSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  choiceTextSelected: {
    color: colors.white,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.screenX,
    paddingBottom: spacing.xxxl,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.size.base,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
});

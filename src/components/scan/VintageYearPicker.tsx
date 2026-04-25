import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
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

type Props = {
  knownYears?: number[];
  maxYear?: number;
  minYear?: number;
  onChange: (vintageYear: number | null) => void;
  suggestedYear?: number | null;
  value: number | null;
};

const LIST_MIN_YEAR = 1990;

function uniqueYears(years: number[], minYear: number, maxYear: number) {
  return [...new Set(years)]
    .filter((year) => Number.isInteger(year) && year >= minYear && year <= maxYear)
    .sort((a, b) => b - a);
}

export function VintageYearPicker({
  knownYears = [],
  maxYear = new Date().getFullYear() + 1,
  minYear = 1900,
  onChange,
  suggestedYear,
  value,
}: Props) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [manualYear, setManualYear] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const listMinYear = Math.max(LIST_MIN_YEAR, minYear);
  const normalizedKnownYears = useMemo(
    () => uniqueYears(knownYears, minYear, maxYear),
    [knownYears, maxYear, minYear]
  );
  const quickYears = useMemo(() => {
    const lastCompleteYear = new Date().getFullYear() - 1;

    return uniqueYears(
      Array.from({ length: 5 }, (_, index) => lastCompleteYear - index),
      minYear,
      maxYear
    );
  }, [maxYear, minYear]);
  const pickerYears = useMemo(
    () =>
      Array.from(
        { length: maxYear - listMinYear + 1 },
        (_, index) => maxYear - index
      ),
    [listMinYear, maxYear]
  );
  const showSuggestion =
    typeof suggestedYear === 'number' &&
    suggestedYear >= minYear &&
    suggestedYear <= maxYear;

  function selectYear(year: number) {
    onChange(year);
    setManualError(null);
    setManualYear('');
    setIsPickerOpen(false);
  }

  function submitManualYear() {
    const parsedYear = Number(manualYear.trim());

    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < minYear ||
      parsedYear > maxYear
    ) {
      setManualError(`Bitte wähle ein Jahr zwischen ${minYear} und ${maxYear}.`);
      return;
    }

    selectYear(parsedYear);
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Jahrgang*</Text>
          <Text style={styles.requiredText}>Pflichtfeld</Text>
        </View>
        {value ? (
          <Pressable onPress={() => onChange(null)} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Leeren</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel="Jahrgang auswählen"
        onPress={() => setIsPickerOpen(true)}
        style={[styles.selectBox, !value && styles.selectBoxMissing]}
      >
        <Text style={[styles.selectText, !value && styles.placeholderText]}>
          {value ? String(value) : 'Bitte auswählen'}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </Pressable>

      {showSuggestion ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Vorschlag der KI</Text>
          <Pressable
            onPress={() => selectYear(suggestedYear)}
            style={styles.suggestionButton}
          >
            <Ionicons
              name="sparkles-outline"
              size={18}
              color={colors.primaryDark}
            />
            <Text style={styles.suggestionText}>{suggestedYear}</Text>
            <Text style={styles.suggestionAction}>Übernehmen</Text>
          </Pressable>
        </View>
      ) : null}

      {normalizedKnownYears.length > 0 ? (
        <YearPills
          label="Bekannte Jahrgänge"
          onSelect={selectYear}
          selectedYear={value}
          years={normalizedKnownYears}
        />
      ) : null}

      <YearPills
        label="Schnellauswahl"
        onSelect={selectYear}
        selectedYear={value}
        years={quickYears}
      />

      {!value ? (
        <View style={styles.missingHint}>
          <Ionicons name="warning-outline" size={18} color={colors.warning} />
          <Text style={styles.missingHintText}>
            Wähle den Jahrgang aktiv aus, bevor du den Wein speicherst.
          </Text>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={isPickerOpen}
        onRequestClose={() => setIsPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Jahrgangsauswahl schließen"
            onPress={() => setIsPickerOpen(false)}
            style={styles.modalBackdrop}
          />
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Jahrgang wählen</Text>
              <Pressable onPress={() => setIsPickerOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.manualRow}>
              <TextInput
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={(text) => {
                  setManualYear(text.replace(/[^0-9]/g, ''));
                  setManualError(null);
                }}
                placeholder="Jahr eingeben"
                placeholderTextColor={colors.placeholder}
                returnKeyType="done"
                style={styles.manualInput}
                value={manualYear}
              />
              <Pressable onPress={submitManualYear} style={styles.manualButton}>
                <Text style={styles.manualButtonText}>Wählen</Text>
              </Pressable>
            </View>

            {manualError ? (
              <Text style={styles.manualError}>{manualError}</Text>
            ) : null}

            <ScrollView style={styles.yearList}>
              {pickerYears.map((year) => (
                <Pressable
                  key={year}
                  onPress={() => selectYear(year)}
                  style={[
                    styles.yearListItem,
                    value === year && styles.yearListItemSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.yearListText,
                      value === year && styles.yearListTextSelected,
                    ]}
                  >
                    {year}
                  </Text>
                  {value === year ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.primary}
                    />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function YearPills({
  label,
  onSelect,
  selectedYear,
  years,
}: {
  label: string;
  onSelect: (year: number) => void;
  selectedYear: number | null;
  years: number[];
}) {
  if (years.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.pills}>
        {years.map((year) => {
          const selected = selectedYear === year;

          return (
            <Pressable
              key={year}
              onPress={() => onSelect(year)}
              style={[styles.pill, selected && styles.pillSelected]}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {year}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  clearButton: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  clearButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  manualButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  manualButtonText: {
    color: colors.white,
    fontSize: typography.size.md,
    fontWeight: typography.weight.extraBold,
  },
  manualError: {
    color: colors.error,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  manualInput: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: typography.size.base,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  manualRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  missingHint: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  missingHintText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.shadow,
    opacity: 0.35,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.lg,
    maxHeight: '82%',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
  },
  pill: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    color: colors.primaryDark,
    fontSize: typography.size.md,
    fontWeight: typography.weight.extraBold,
  },
  pillTextSelected: {
    color: colors.white,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  placeholderText: {
    color: colors.placeholder,
  },
  requiredText: {
    color: colors.warning,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  selectBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  selectBoxMissing: {
    borderColor: colors.warning,
  },
  selectText: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  suggestionAction: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
    marginLeft: 'auto',
  },
  suggestionButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  suggestionText: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
  },
  yearList: {
    maxHeight: 360,
  },
  yearListItem: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  yearListItemSelected: {
    backgroundColor: colors.surfaceWarm,
  },
  yearListText: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  yearListTextSelected: {
    color: colors.primaryDark,
  },
});

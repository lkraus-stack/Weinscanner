import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

import { StarPicker } from './StarPicker';

export type RatingFormValue = {
  drankAt: string;
  notes: string;
  occasion: string;
  stars: number;
};

type Props = {
  disabled?: boolean;
  onChange: (value: RatingFormValue) => void;
  value: RatingFormValue;
};

const OCCASION_SUGGESTIONS = [
  'Restaurant',
  'Geburtstag',
  'Probe',
  'Abendessen mit Freunden',
  'Allein',
] as const;

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const NOTES_MIN_HEIGHT = 112;
const NOTES_MAX_HEIGHT = typography.lineHeight.base * 6 + spacing.lg * 2;

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function dateFromInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function formatDisplayDate(value: string) {
  return DATE_FORMATTER.format(dateFromInputValue(value));
}

export function getTodayRatingDate() {
  return toDateInputValue(new Date());
}

export function RatingForm({ disabled = false, onChange, value }: Props) {
  const [notesHeight, setNotesHeight] = useState(NOTES_MIN_HEIGHT);

  function updateField<K extends keyof RatingFormValue>(
    field: K,
    fieldValue: RatingFormValue[K]
  ) {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  }

  function addOccasionSuggestion(suggestion: string) {
    const trimmedOccasion = value.occasion.trim();

    if (!trimmedOccasion) {
      updateField('occasion', suggestion);
      return;
    }

    if (trimmedOccasion.includes(suggestion)) {
      return;
    }

    updateField('occasion', `${trimmedOccasion}, ${suggestion}`);
  }

  return (
    <View style={styles.form}>
      <FormSection title="Deine Bewertung">
        <StarPicker
          disabled={disabled}
          onChange={(stars) => updateField('stars', stars)}
          value={value.stars}
        />
      </FormSection>

      <FormSection title="Notizen">
        <TextInput
          editable={!disabled}
          multiline
          onChangeText={(text) => updateField('notes', text)}
          onContentSizeChange={(event) => {
            setNotesHeight(
              Math.min(
                Math.max(event.nativeEvent.contentSize.height, NOTES_MIN_HEIGHT),
                NOTES_MAX_HEIGHT
              )
            );
          }}
          placeholder="Was hat dir gefallen? Was nicht?"
          placeholderTextColor={colors.placeholder}
          scrollEnabled={notesHeight >= NOTES_MAX_HEIGHT}
          style={[styles.input, styles.notesInput, { height: notesHeight }]}
          textAlignVertical="top"
          value={value.notes}
        />
      </FormSection>

      <FormSection title="Wann getrunken?">
        <DateInput
          disabled={disabled}
          onChange={(drankAt) => updateField('drankAt', drankAt)}
          value={value.drankAt}
        />
      </FormSection>

      <FormSection title="Anlass (optional)">
        <TextInput
          editable={!disabled}
          onChangeText={(text) => updateField('occasion', text)}
          placeholder="Restaurant XYZ, Geburtstag"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          value={value.occasion}
        />

        <View style={styles.suggestions}>
          {OCCASION_SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              disabled={disabled}
              onPress={() => addOccasionSuggestion(suggestion)}
              style={({ pressed }) => [
                styles.suggestionPill,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      </FormSection>
    </View>
  );
}

function DateInput({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
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
        accessibilityLabel="Getrunken am auswählen"
        disabled={disabled}
        onPress={() => setIsPickerVisible((visible) => !visible)}
        style={({ pressed }) => [
          styles.dateButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.dateText}>{formatDisplayDate(value)}</Text>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={colors.primaryDark}
        />
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
    gap: spacing.md,
  },
  form: {
    gap: spacing.xxl,
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
  suggestionPill: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

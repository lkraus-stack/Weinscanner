import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

type Props = {
  onDebouncedChange: (value: string) => void;
  value: string;
};

const SEARCH_DEBOUNCE_MS = 300;

export function HistorySearchBar({ onDebouncedChange, value }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDebouncedChange(draftValue);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draftValue, onDebouncedChange]);

  function clearSearch() {
    setDraftValue('');
    onDebouncedChange('');
  }

  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color={colors.textSecondary} />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Wein, Region oder Rebsorte suchen"
        placeholderTextColor={colors.placeholder}
        onChangeText={setDraftValue}
        returnKeyType="search"
        style={styles.input}
        value={draftValue}
      />
      {draftValue ? (
        <Pressable
          accessibilityLabel="Suche löschen"
          accessibilityRole="button"
          onPress={clearSearch}
          style={styles.clearButton}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  clearButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    minWidth: 0,
  },
  });
}

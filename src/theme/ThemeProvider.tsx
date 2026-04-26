import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { usePreferences } from '@/hooks/usePreferences';
import {
  themeColors,
  type ThemeColors,
} from '@/theme/colors';

export type { ThemeColors } from '@/theme/colors';

export type ThemeMode = 'auto' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

type ThemeContextValue = {
  colors: ThemeColors;
  mode: ThemeMode;
  resolved: ResolvedTheme;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: themeColors.light,
  mode: 'auto',
  resolved: 'light',
});

function resolveTheme(mode: ThemeMode, systemScheme: ReturnType<typeof useColorScheme>) {
  if (mode === 'auto') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }

  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { preferences } = usePreferences();
  const mode = preferences.theme;
  const resolved = resolveTheme(mode, systemScheme);
  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: themeColors[resolved],
      mode,
      resolved,
    }),
    [mode, resolved]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

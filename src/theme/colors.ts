export const lightColors = {
  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceWarm: '#FFFDF9',
  skeletonBase: '#EFE8DC',
  skeletonHighlight: '#FFF9F0',
  primary: '#B85C4A',
  primaryDark: '#8B3A2A',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  placeholder: '#8A8178',
  shadow: '#1A1A1A',
  border: '#E5E0D5',
  success: '#2E7D32',
  warning: '#F57C00',
  error: '#C62828',
  overlay: 'rgba(26, 26, 26, 0.34)',
  white: '#FFFFFF',
  wineWhite: '#F4E4A8',
  wineRed: '#722F37',
  wineRose: '#FFB6A6',
  wineSparkling: '#FFE4B5',
} as const;

type ColorTokenName = keyof typeof lightColors;

export type ThemeColors = Record<ColorTokenName, string>;

export const darkColors = {
  background: '#1A1612',
  surface: '#2A241F',
  surfaceElevated: '#352D27',
  surfaceWarm: '#241E19',
  skeletonBase: '#2A241F',
  skeletonHighlight: '#3A332D',
  primary: '#C97362',
  primaryDark: '#B85C4A',
  text: '#F5F1EB',
  textSecondary: '#A8A29A',
  placeholder: '#8F877D',
  shadow: '#0B0907',
  border: '#3A332D',
  success: '#4CAF50',
  warning: '#FFA726',
  error: '#EF5350',
  overlay: 'rgba(0, 0, 0, 0.5)',
  white: '#FFFFFF',
  wineWhite: '#D4C68F',
  wineRed: '#5A1F26',
  wineRose: '#D89B8E',
  wineSparkling: '#D4B888',
} as const satisfies ThemeColors;

export const themeColors = {
  dark: darkColors,
  light: lightColors,
} as const;

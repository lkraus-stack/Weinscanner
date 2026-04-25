import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

type TabBarIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  isScan?: boolean;
};

export function TabBarIcon({ name, color, focused, isScan }: TabBarIconProps) {
  if (isScan) {
    return (
      <View style={[styles.scanButton, focused && styles.scanButtonFocused]}>
        <Ionicons name={name} size={27} color={colors.white} />
      </View>
    );
  }

  return <Ionicons name={name} size={focused ? 25 : 23} color={color} />;
}

const styles = StyleSheet.create({
  scanButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    width: 56,
  },
  scanButtonFocused: {
    backgroundColor: colors.primaryDark,
  },
});

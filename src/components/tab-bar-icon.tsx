import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type TabBarIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  isScan?: boolean;
};

export function TabBarIcon({ name, color, focused, isScan }: TabBarIconProps) {
  const { colors } = useTheme();

  if (isScan) {
    return (
      <View
        style={[
          styles.scanButton,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primaryDark,
          },
          focused && { backgroundColor: colors.primaryDark },
        ]}
      >
        <Ionicons name={name} size={27} color={colors.white} />
      </View>
    );
  }

  return <Ionicons name={name} size={focused ? 25 : 23} color={color} />;
}

const styles = StyleSheet.create({
  scanButton: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginTop: -22,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    width: 56,
  },
});

import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarIcon } from '@/components/tab-bar-icon';
import { spacing } from '@/theme/spacing';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

const TAB_BAR_BASE_HEIGHT = 62;

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottomPadding = Math.max(insets.bottom, spacing.sm);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.bold,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: TAB_BAR_BASE_HEIGHT + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: spacing.sm,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Verlauf',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name={focused ? 'time' : 'time-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Bestand',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name={focused ? 'cube' : 'cube-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              isScan
              name={focused ? 'camera' : 'camera-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ratings"
        options={{
          title: 'Bewertet',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name={focused ? 'star' : 'star-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name={focused ? 'person' : 'person-outline'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="scan-review"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="scan-confirm"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="wine-detail"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

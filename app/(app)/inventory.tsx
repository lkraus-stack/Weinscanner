import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { colors } from '@/theme/colors';

export default function InventoryScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <EmptyState
        icon="cube-outline"
        title="Dein Bestand ist leer"
        description="Deine Flaschen und Lagerorte erscheinen hier, sobald du Weine zum Bestand hinzufügst."
        cta={{
          label: 'Wein scannen',
          onPress: () => router.push('/(app)/scan'),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});

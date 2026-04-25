import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { colors } from '@/theme/colors';

export default function RatingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <EmptyState
        icon="star-outline"
        title="Noch keine Bewertungen"
        description="Bewertete Weine sammeln sich hier mit Sternen, Notizen und Anlass."
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

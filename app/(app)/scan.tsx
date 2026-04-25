import { Alert, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { colors } from '@/theme/colors';

export default function ScanScreen() {
  function showCameraInfo() {
    Alert.alert(
      'Kamera kommt in Sprint 05',
      'Im nächsten Sprint aktivieren wir Aufnahme, Zuschnitt und Upload.'
    );
  }

  return (
    <View style={styles.screen}>
      <EmptyState
        icon="camera-outline"
        title="Scanner bereit"
        description="Der Scan-Tab ist vorbereitet. Die Kamera wird im nächsten Sprint angeschlossen."
        cta={{
          label: 'Kamera kommt in Sprint 05',
          onPress: showCameraInfo,
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

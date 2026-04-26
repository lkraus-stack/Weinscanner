import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraHeader } from '@/components/scan/CameraHeader';
import { CameraOverlay } from '@/components/scan/CameraOverlay';
import { CaptureButton } from '@/components/scan/CaptureButton';
import { PermissionDeniedView } from '@/components/scan/PermissionDeniedView';
import {
  openAppSettings,
  requestMediaLibraryPermission,
} from '@/lib/permissions';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/spacing';

const FLASH_MODES: FlashMode[] = ['auto', 'on', 'off'];

export default function ScanScreen() {
  const { colors, styles } = useScanStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ scanTarget?: string }>();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const isBackLabelScan = params.scanTarget === 'back-label';

  function goToReview(uri: string, width?: number, height?: number) {
    router.push({
      pathname: '/scan-review',
      params: {
        height: height ? String(height) : '',
        uri,
        width: width ? String(width) : '',
      },
    });
  }

  function toggleFlashMode() {
    setFlashMode((currentMode) => {
      const currentIndex = FLASH_MODES.indexOf(currentMode);
      const nextIndex = (currentIndex + 1) % FLASH_MODES.length;

      return FLASH_MODES[nextIndex];
    });
  }

  async function capturePhoto() {
    if (!cameraRef.current || !isCameraReady || isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.95,
        skipProcessing: true,
      });

      if (!photo?.uri) {
        throw new Error('Kein Foto erhalten.');
      }

      goToReview(photo.uri, photo.width, photo.height);
    } catch {
      Alert.alert(
        'Foto fehlgeschlagen',
        'Das Foto konnte nicht aufgenommen werden. Bitte versuche es erneut.'
      );
    } finally {
      setIsCapturing(false);
    }
  }

  async function pickImageFromLibrary() {
    try {
      setIsPickingImage(true);

      const hasPermission = await requestMediaLibraryPermission();

      if (!hasPermission) {
        Alert.alert(
          'Fotos nicht freigegeben',
          'Bitte erlaube den Zugriff auf deine Fotos, um ein Etikett zu importieren.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Einstellungen öffnen', onPress: openAppSettings },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];

      goToReview(asset.uri, asset.width, asset.height);
    } catch {
      Alert.alert(
        'Import fehlgeschlagen',
        'Das Foto konnte nicht importiert werden. Bitte versuche es erneut.'
      );
    } finally {
      setIsPickingImage(false);
    }
  }

  if (!permission?.granted) {
    return (
      <PermissionDeniedView
        canAskAgain={permission?.canAskAgain ?? true}
        onOpenSettings={openAppSettings}
        onRequestPermission={requestPermission}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        animateShutter
        facing="back"
        flash={flashMode}
        mode="picture"
        onCameraReady={() => setIsCameraReady(true)}
        style={StyleSheet.absoluteFill}
      />

      <CameraOverlay
        hint={
          isBackLabelScan
            ? 'Rücketikett oder Kapsel im Rahmen ausrichten'
            : 'Etikett im Rahmen ausrichten'
        }
      />

      <CameraHeader
        flashMode={flashMode}
        onClose={() => router.replace('/(app)')}
        onToggleFlash={toggleFlashMode}
        topInset={insets.top}
      />

      <View style={[styles.footer, { bottom: insets.bottom + spacing.xxl }]}>
        <Pressable
          accessibilityLabel="Foto aus Galerie importieren"
          disabled={isPickingImage || isCapturing}
          onPress={pickImageFromLibrary}
          style={styles.sideButton}
        >
          <Ionicons name="images-outline" size={27} color={colors.white} />
        </Pressable>

        <CaptureButton
          disabled={!isCameraReady || isCapturing}
          isLoading={isCapturing}
          onPress={capturePhoto}
        />

        <Pressable
          accessibilityLabel="Kamera wechseln"
          disabled
          style={[styles.sideButton, styles.sideButtonDisabled]}
        >
          <Ionicons
            name="camera-reverse-outline"
            size={27}
            color={colors.white}
          />
        </Pressable>
      </View>
    </View>
  );
}

function useScanStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { colors, styles };
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: {
    backgroundColor: colors.text,
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: spacing.xxl,
    position: 'absolute',
    right: spacing.xxl,
  },
  sideButton: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    opacity: 0.82,
    width: 54,
  },
  sideButtonDisabled: {
    opacity: 0.35,
  },
  });
}

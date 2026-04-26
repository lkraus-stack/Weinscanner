import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReviewActions } from '@/components/scan/ReviewActions';
import { UploadOverlay } from '@/components/scan/UploadOverlay';
import { useScanFlow } from '@/hooks/useScanFlow';
import { cropImage, getImageDimensions, type CropRect } from '@/lib/image';
import { uploadWineLabel } from '@/lib/storage';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type CropPreset = 'original' | 'label' | 'square';

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseDimension(value: string | string[] | undefined) {
  const normalizedValue = normalizeParam(value);
  const numericValue = normalizedValue ? Number(normalizedValue) : 0;

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function getCenteredCrop(width: number, height: number, aspectRatio: number): CropRect {
  const imageRatio = width / height;

  if (imageRatio > aspectRatio) {
    const cropWidth = height * aspectRatio;

    return {
      height: Math.round(height),
      originX: Math.round((width - cropWidth) / 2),
      originY: 0,
      width: Math.round(cropWidth),
    };
  }

  const cropHeight = width / aspectRatio;

  return {
    height: Math.round(cropHeight),
    originX: 0,
    originY: Math.round((height - cropHeight) / 2),
    width: Math.round(width),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

export default function ScanReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    height?: string;
    uri?: string;
    width?: string;
  }>();
  const initialUri = normalizeParam(params.uri);
  const initialWidth = parseDimension(params.width);
  const initialHeight = parseDimension(params.height);
  const flow = useScanFlow(initialUri);
  const originalUriRef = useRef(initialUri ?? null);
  const originalDimensionsRef = useRef(
    initialWidth && initialHeight
      ? { height: initialHeight, width: initialWidth }
      : null
  );
  const uploadRunRef = useRef(0);
  const [selectedCrop, setSelectedCrop] = useState<CropPreset>('original');
  const [isCropModalVisible, setIsCropModalVisible] = useState(false);

  const isUploading = flow.state.status === 'uploading';
  const isCropping = flow.state.status === 'cropping';

  function goBackToCamera() {
    flow.retake();
    router.replace('/(app)/scan');
  }

  function openCropModal() {
    flow.startCropping();
    setIsCropModalVisible(true);
  }

  function closeCropModal() {
    setIsCropModalVisible(false);
    flow.reset();
  }

  async function getOriginalDimensions() {
    if (originalDimensionsRef.current) {
      return originalDimensionsRef.current;
    }

    if (!originalUriRef.current) {
      throw new Error('Bild fehlt.');
    }

    const dimensions = await getImageDimensions(originalUriRef.current);
    originalDimensionsRef.current = dimensions;

    return dimensions;
  }

  async function applyCrop(preset: CropPreset) {
    if (!originalUriRef.current) {
      return;
    }

    try {
      flow.startCropping();
      setSelectedCrop(preset);

      if (preset === 'original') {
        flow.setUri(originalUriRef.current);
        setIsCropModalVisible(false);
        return;
      }

      const dimensions = await getOriginalDimensions();
      const crop =
        preset === 'label'
          ? getCenteredCrop(dimensions.width, dimensions.height, 4 / 5)
          : getCenteredCrop(dimensions.width, dimensions.height, 1);
      const croppedUri = await cropImage(originalUriRef.current, crop);

      flow.setUri(croppedUri);
      setIsCropModalVisible(false);
    } catch (error: unknown) {
      flow.reset();
      Alert.alert('Bearbeitung fehlgeschlagen', getErrorMessage(error));
    }
  }

  function cancelUpload() {
    // Supabase Storage has no reliable React Native abort hook here yet.
    // Sprint 16 can replace this UI-cancel with a real network abort.
    uploadRunRef.current += 1;
    flow.reset();
  }

  async function uploadPhoto() {
    if (!flow.state.uri || isUploading) {
      return;
    }

    const uploadRunId = uploadRunRef.current + 1;
    uploadRunRef.current = uploadRunId;
    flow.startUpload();

    try {
      const uploadResult = await uploadWineLabel(flow.state.uri);

      if (uploadRunId !== uploadRunRef.current) {
        return;
      }

      flow.completeUpload(uploadResult);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/scan-confirm',
        params: {
          signedUrl: uploadResult.signedUrl,
          storagePath: uploadResult.storagePath,
        },
      });
    } catch (error: unknown) {
      if (uploadRunId !== uploadRunRef.current) {
        return;
      }

      const message = getErrorMessage(error);
      flow.failUpload(message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Upload fehlgeschlagen', message, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Erneut versuchen', onPress: uploadPhoto },
      ]);
    }
  }

  if (!flow.state.uri) {
    return (
      <View style={styles.errorScreen}>
        <Ionicons name="image-outline" size={44} color={colors.primary} />
        <Text style={styles.errorTitle}>Kein Foto gefunden</Text>
        <Text style={styles.errorDescription}>
          Bitte nimm ein neues Etikett-Foto auf.
        </Text>
        <Pressable onPress={goBackToCamera} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Zur Kamera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityLabel="Zurück zur Kamera"
          onPress={goBackToCamera}
          style={styles.headerButton}
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Foto prüfen</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.imageArea}>
        <Image
          source={{ uri: flow.state.uri }}
          style={styles.image}
          contentFit="contain"
          transition={160}
        />
      </View>

      <View style={{ paddingBottom: insets.bottom + spacing.md }}>
        <ReviewActions
          disabled={isCropping}
          isUploading={isUploading}
          onCrop={openCropModal}
          onRetake={goBackToCamera}
          onUpload={uploadPhoto}
        />
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isCropModalVisible}
        onRequestClose={closeCropModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeCropModal} />
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Bild zuschneiden</Text>
            <Text style={styles.modalDescription}>
              Wähle einen schnellen Zuschnitt für das Etikett.
            </Text>

            <CropOption
              label="Original"
              selected={selectedCrop === 'original'}
              onPress={() => applyCrop('original')}
            />
            <CropOption
              label="4:5 zentriert"
              selected={selectedCrop === 'label'}
              onPress={() => applyCrop('label')}
            />
            <CropOption
              label="Quadrat"
              selected={selectedCrop === 'square'}
              onPress={() => applyCrop('square')}
            />

            {isCropping ? (
              <View style={styles.cropLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.cropLoadingText}>Wird bearbeitet...</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <UploadOverlay visible={isUploading} onCancel={cancelUpload} />
    </View>
  );
}

type CropOptionProps = {
  label: string;
  onPress: () => void;
  selected: boolean;
};

function CropOption({ label, onPress, selected }: CropOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.cropOption, selected && styles.cropOptionSelected]}
    >
      <Text
        style={[
          styles.cropOptionText,
          selected && styles.cropOptionTextSelected,
        ]}
      >
        {label}
      </Text>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cropLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingTop: spacing.sm,
  },
  cropLoadingText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
  },
  cropOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  cropOptionSelected: {
    borderColor: colors.primary,
  },
  cropOptionText: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  cropOptionTextSelected: {
    color: colors.primaryDark,
  },
  errorButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 52,
    paddingHorizontal: spacing.xl,
  },
  errorButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  errorDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screenX,
  },
  errorTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    marginTop: spacing.lg,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  imageArea: {
    backgroundColor: colors.text,
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
    opacity: 0.68,
  },
  modalDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalPanel: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
    shadowColor: colors.shadow,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    width: '100%',
  },
  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screenX,
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    textAlign: 'center',
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});

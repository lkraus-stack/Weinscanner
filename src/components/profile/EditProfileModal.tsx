import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  openAppSettings,
  requestMediaLibraryPermission,
} from '@/lib/permissions';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type EditProfileValue = {
  avatarLocalUri: string | null;
  displayName: string;
};

type Props = {
  avatarUrl: string | null;
  displayName: string;
  email: string;
  fallbackInitial: string;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (value: EditProfileValue) => void | Promise<void>;
  visible: boolean;
};

export function EditProfileModal({
  avatarUrl,
  displayName,
  email,
  fallbackInitial,
  isSaving = false,
  onClose,
  onSubmit,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(displayName);
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const previewUri = avatarLocalUri ?? avatarUrl;

  useEffect(() => {
    if (visible) {
      setName(displayName);
      setAvatarLocalUri(null);
    }
  }, [displayName, visible]);

  async function pickAvatar() {
    try {
      const hasPermission = await requestMediaLibraryPermission();

      if (!hasPermission) {
        Alert.alert(
          'Fotos nicht freigegeben',
          'Bitte erlaube den Zugriff auf deine Fotos, um einen Avatar auszuwählen.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Einstellungen öffnen', onPress: openAppSettings },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      await Haptics.selectionAsync();
      setAvatarLocalUri(result.assets[0].uri);
    } catch {
      Alert.alert(
        'Avatar konnte nicht geladen werden',
        'Bitte versuche es noch einmal.'
      );
    }
  }

  async function submit() {
    await onSubmit({
      avatarLocalUri,
      displayName: name,
    });
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable
            accessibilityLabel="Profil schließen"
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onClose}
            style={styles.headerIconButton}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Profil bearbeiten</Text>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={submit}
            style={[styles.saveButton, isSaving && styles.disabled]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Speichern</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xxxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarBlock}>
            <Pressable
              accessibilityLabel="Avatar auswählen"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={pickAvatar}
              style={({ pressed }) => [
                styles.avatarShell,
                pressed && styles.pressed,
              ]}
            >
              {previewUri ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: previewUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarInitial}>{fallbackInitial}</Text>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera-outline" size={16} color={colors.white} />
              </View>
            </Pressable>
            <Text style={styles.email}>{email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Display-Name</Text>
            <TextInput
              editable={!isSaving}
              onChangeText={setName}
              placeholder="Dein Name"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              value={name}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avatarBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarEditBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    bottom: 2,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 32,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitial: {
    color: colors.primaryDark,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
  },
  avatarShell: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 116,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 116,
  },
  content: {
    gap: spacing.xxxl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
  },
  disabled: {
    opacity: 0.5,
  },
  email: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerIconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: colors.text,
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.size.base,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  pressed: {
    opacity: 0.78,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 96,
    paddingHorizontal: spacing.md,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
});

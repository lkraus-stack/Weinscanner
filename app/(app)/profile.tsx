import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import {
  EditProfileModal,
  type EditProfileValue,
} from '@/components/profile/EditProfileModal';
import { usePreferences } from '@/hooks/usePreferences';
import { useProfile } from '@/hooks/useProfile';
import { useUserStats, type UserStats } from '@/hooks/useUserStats';
import { deleteAccount } from '@/lib/account';
import { env } from '@/lib/env';
import { exportUserData } from '@/lib/export';
import {
  normalizePreferences,
  updateProfile,
  uploadAvatar,
  type ThemePreference,
} from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type ThemeOption = {
  label: string;
  value: ThemePreference;
};

type ExportFormat = 'csv' | 'json';

const THEME_OPTIONS: ThemeOption[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'Hell', value: 'light' },
  { label: 'Dunkel', value: 'dark' },
];
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

function getDisplayName(profileName: string | null | undefined, email: string) {
  if (profileName?.trim()) {
    return profileName.trim();
  }

  const localPart = email.split('@')[0];

  return localPart || 'Weinfreund';
}

function getInitial(displayName: string) {
  return displayName.trim().charAt(0).toLocaleUpperCase('de-DE') || 'W';
}

function formatTheme(value: ThemePreference) {
  return THEME_OPTIONS.find((option) => option.value === value)?.label ?? 'Auto';
}

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const profileQuery = useProfile();
  const statsQuery = useUserStats();
  const preferencesQuery = usePreferences();
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isThemeModalVisible, setIsThemeModalVisible] = useState(false);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const email = user?.email ?? 'unbekannte E-Mail';
  const profile = profileQuery.data;
  const preferences = useMemo(
    () => normalizePreferences(profile?.preferences ?? null),
    [profile?.preferences]
  );
  const displayName = getDisplayName(profile?.display_name, email);
  const fallbackInitial = getInitial(displayName);

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    },
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Logout fehlgeschlagen', getErrorMessage(error));
    },
  });

  const editProfileMutation = useMutation({
    mutationFn: async (value: EditProfileValue) => {
      const avatarPath = value.avatarLocalUri
        ? await uploadAvatar(value.avatarLocalUri)
        : profile?.avatar_url;

      return updateProfile({
        avatar_url: avatarPath ?? null,
        display_name: value.displayName,
      });
    },
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Profil konnte nicht gespeichert werden', getErrorMessage(error));
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditModalVisible(false);
      showToast('Profil gespeichert');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['user-stats'] }),
      ]);
    },
  });

  const exportMutation = useMutation({
    mutationFn: (format: ExportFormat) => exportUserData({ format }),
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Export fehlgeschlagen', getErrorMessage(error));
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsExportModalVisible(false);
      showToast('Export erstellt');
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Account konnte nicht gelöscht werden', getErrorMessage(error));
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsDeleteModalVisible(false);
      showToast('Account gelöscht');
      router.replace('/(auth)/login');
    },
  });

  async function updatePreference<K extends keyof typeof preferences>(
    key: K,
    value: (typeof preferences)[K]
  ) {
    try {
      await Haptics.selectionAsync();
      await preferencesQuery.updatePreference(key, value);
      showToast('Einstellung gespeichert');
    } catch (error: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Einstellung konnte nicht gespeichert werden', getErrorMessage(error));
    }
  }

  function openLegalLink(url: string | null, title: string) {
    if (!url) {
      Alert.alert(
        title,
        'Der Link ist noch nicht hinterlegt. Setze ihn über die App-Konfiguration.'
      );
      return;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert(title, 'Der Link konnte nicht geöffnet werden.');
    });
  }

  function handleSentryTest() {
    if (!sentryDsn) {
      Alert.alert(
        'Sentry nicht aktiv',
        'Es ist noch kein Sentry DSN in der App-Konfiguration gesetzt.'
      );
      return;
    }

    Sentry.captureException(new Error('Sentry Test'));
    Alert.alert(
      'Sentry-Test gesendet',
      'Wenn ein echter DSN gesetzt ist, sollte der Fehler gleich im Dashboard erscheinen.'
    );
  }

  const isLoading = profileQuery.isLoading || statsQuery.isLoading;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Kellerbuch</Text>
          <Text style={styles.screenTitle}>Profil</Text>
        </View>

        <ProfileHeader
          avatarUrl={profile?.avatarSignedUrl ?? null}
          displayName={displayName}
          email={email}
          fallbackInitial={fallbackInitial}
          isLoading={profileQuery.isLoading}
          onEdit={() => setIsEditModalVisible(true)}
        />

        <Section title="Deine Wein-Reise">
          <UserStatsCard
            isLoading={isLoading}
            stats={statsQuery.data}
          />
        </Section>

        <Section title="Einstellungen">
          <SettingsPanel>
            <SettingsRow
              icon="color-palette-outline"
              label="Erscheinungsbild"
              onPress={() => setIsThemeModalVisible(true)}
              value={formatTheme(preferences.theme)}
            />
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                Dark Mode kommt mit der nächsten Version.
              </Text>
            </View>
            <SettingsRow
              icon="cube-outline"
              label="Leere Bestände ausblenden"
              rightElement={
                <Switch
                  onValueChange={(value) =>
                    updatePreference('hide_empty_inventory', value)
                  }
                  thumbColor={colors.white}
                  trackColor={{
                    false: colors.border,
                    true: colors.primary,
                  }}
                  value={preferences.hide_empty_inventory}
                />
              }
            />
            <SettingsRow
              icon="language-outline"
              label="Sprache"
              value="Deutsch"
            />
            <SettingsRow
              icon="notifications-outline"
              label="Notifications"
              rightElement={
                <Switch
                  onValueChange={(value) =>
                    updatePreference('notifications_enabled', value)
                  }
                  thumbColor={colors.white}
                  trackColor={{
                    false: colors.border,
                    true: colors.primary,
                  }}
                  value={preferences.notifications_enabled}
                />
              }
            />
          </SettingsPanel>
        </Section>

        <Section title="Daten">
          <SettingsPanel>
            <SettingsRow
              icon="download-outline"
              isBusy={exportMutation.isPending}
              label="Daten exportieren"
              onPress={() => setIsExportModalVisible(true)}
            />
            <SettingsRow
              icon="shield-checkmark-outline"
              label="Datenschutz"
              onPress={() => openLegalLink(env.PRIVACY_URL, 'Datenschutz')}
              value="Öffnen"
            />
            <SettingsRow
              icon="document-text-outline"
              label="Impressum"
              onPress={() => openLegalLink(env.IMPRINT_URL, 'Impressum')}
              value="Öffnen"
            />
          </SettingsPanel>
        </Section>

        <Section title="Account">
          <SettingsPanel>
            <SettingsRow
              icon="log-out-outline"
              isBusy={signOutMutation.isPending}
              label="Logout"
              onPress={() => signOutMutation.mutate()}
            />
            <SettingsRow
              destructive
              icon="trash-outline"
              label="Account löschen"
              onPress={() => setIsDeleteModalVisible(true)}
            />
          </SettingsPanel>
        </Section>

        <View style={styles.versionBlock}>
          <Text style={styles.versionText}>
            Version {Constants.expoConfig?.version ?? '0.1.0'}
          </Text>
        </View>

        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleSentryTest}
            style={({ pressed }) => [
              styles.sentryButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="bug-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.sentryButtonText}>
              Sentry Test-Fehler senden
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <EditProfileModal
        avatarUrl={profile?.avatarSignedUrl ?? null}
        displayName={displayName}
        email={email}
        fallbackInitial={fallbackInitial}
        isSaving={editProfileMutation.isPending}
        onClose={() => setIsEditModalVisible(false)}
        onSubmit={(value) => editProfileMutation.mutate(value)}
        visible={isEditModalVisible}
      />

      <ThemeModal
        currentTheme={preferences.theme}
        isSaving={preferencesQuery.isUpdatingPreference}
        onCancel={() => setIsThemeModalVisible(false)}
        onSelect={(theme) => {
          updatePreference('theme', theme).finally(() =>
            setIsThemeModalVisible(false)
          );
        }}
        visible={isThemeModalVisible}
      />

      <ExportModal
        isExporting={exportMutation.isPending}
        onCancel={() => setIsExportModalVisible(false)}
        onSelect={(format) => exportMutation.mutate(format)}
        visible={isExportModalVisible}
      />

      <DeleteAccountModal
        email={email}
        isDeleting={deleteAccountMutation.isPending}
        onClose={() => setIsDeleteModalVisible(false)}
        onConfirm={(confirmEmail) => deleteAccountMutation.mutate(confirmEmail)}
        visible={isDeleteModalVisible}
      />
    </SafeAreaView>
  );
}

function ProfileHeader({
  avatarUrl,
  displayName,
  email,
  fallbackInitial,
  isLoading,
  onEdit,
}: {
  avatarUrl: string | null;
  displayName: string;
  email: string;
  fallbackInitial: string;
  isLoading: boolean;
  onEdit: () => void;
}) {
  return (
    <View style={styles.profileHeader}>
      <View style={styles.avatarFrame}>
        {avatarUrl ? (
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: avatarUrl }}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarInitial}>{fallbackInitial}</Text>
        )}
      </View>

      <View style={styles.profileCopy}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text numberOfLines={1} style={styles.profileName}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={styles.profileEmail}>
              {email}
            </Text>
          </>
        )}
      </View>

      <Pressable
        accessibilityLabel="Profil bearbeiten"
        accessibilityRole="button"
        onPress={onEdit}
        style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
      >
        <Ionicons name="create-outline" size={20} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

function UserStatsCard({
  isLoading,
  stats,
}: {
  isLoading: boolean;
  stats?: UserStats;
}) {
  if (isLoading) {
    return (
      <View style={styles.statsCard}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.statsCard}>
      <View style={styles.statsGrid}>
        <StatCell label="Scans" value={String(stats?.scanCount ?? 0)} />
        <StatCell label="Bew." value={String(stats?.ratingCount ?? 0)} />
        <StatCell label="Reg." value={String(stats?.distinctRegions ?? 0)} />
        <StatCell label="Flaschen" value={String(stats?.totalBottles ?? 0)} />
      </View>
      <View style={styles.topStats}>
        <TopStat label="Top-Region" value={stats?.topRegion ?? 'Offen'} />
        <TopStat
          label="Top-Rebsorte"
          value={stats?.topGrapeVariety ?? 'Offen'}
        />
      </View>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TopStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.topStatRow}>
      <Text style={styles.topStatLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.topStatValue}>
        {value}
      </Text>
    </View>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionLine} />
      </View>
      {children}
    </View>
  );
}

function SettingsPanel({ children }: { children: React.ReactNode }) {
  return <View style={styles.settingsPanel}>{children}</View>;
}

function SettingsRow({
  destructive = false,
  icon,
  isBusy = false,
  label,
  onPress,
  rightElement,
  value,
}: {
  destructive?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  isBusy?: boolean;
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  value?: string;
}) {
  const content = (
    <>
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? colors.error : colors.primaryDark}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}
      >
        {label}
      </Text>
      {isBusy ? <ActivityIndicator color={colors.primary} /> : null}
      {rightElement ? rightElement : null}
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.settingsRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isBusy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && styles.pressed,
        isBusy && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

function ThemeModal({
  currentTheme,
  isSaving,
  onCancel,
  onSelect,
  visible,
}: {
  currentTheme: ThemePreference;
  isSaving: boolean;
  onCancel: () => void;
  onSelect: (theme: ThemePreference) => void;
  visible: boolean;
}) {
  return (
    <BottomSheetModal
      description="Die Auswahl wird gespeichert. Dunkel wird später auf die ganze App angewendet."
      onCancel={onCancel}
      title="Erscheinungsbild"
      visible={visible}
    >
      {THEME_OPTIONS.map((option) => (
        <ModalOption
          key={option.value}
          icon={currentTheme === option.value ? 'checkmark-circle' : 'ellipse-outline'}
          isBusy={isSaving && currentTheme !== option.value}
          label={option.label}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </BottomSheetModal>
  );
}

function ExportModal({
  isExporting,
  onCancel,
  onSelect,
  visible,
}: {
  isExporting: boolean;
  onCancel: () => void;
  onSelect: (format: ExportFormat) => void;
  visible: boolean;
}) {
  return (
    <BottomSheetModal
      description="Der Export enthält deine Profil-, Scan-, Bewertungs-, Bestands- und Korrekturdaten."
      onCancel={onCancel}
      title="Daten exportieren"
      visible={visible}
    >
      <ModalOption
        icon="document-text-outline"
        isBusy={isExporting}
        label="Als CSV exportieren"
        onPress={() => onSelect('csv')}
      />
      <ModalOption
        icon="code-slash-outline"
        isBusy={isExporting}
        label="Als JSON exportieren"
        onPress={() => onSelect('json')}
      />
    </BottomSheetModal>
  );
}

function BottomSheetModal({
  children,
  description,
  onCancel,
  title,
  visible,
}: {
  children: React.ReactNode;
  description: string;
  onCancel: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel={`${title} schließen`}
          onPress={onCancel}
          style={styles.modalBackdrop}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalDescription}>{description}</Text>
          <View style={styles.modalOptions}>{children}</View>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ModalOption({
  icon,
  isBusy,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  isBusy?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isBusy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modalOption,
        pressed && styles.pressed,
        isBusy && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.primaryDark} />
      <Text style={styles.modalOptionText}>{label}</Text>
      {isBusy ? <ActivityIndicator color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarFrame: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 80,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 80,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitial: {
    color: colors.primaryDark,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.md,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  content: {
    gap: spacing.xxxl,
    paddingBottom: 120,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  disabled: {
    opacity: 0.55,
  },
  editButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  hintRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    lineHeight: typography.lineHeight.sm,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 4,
    width: 48,
  },
  modalOption: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  modalOptions: {
    gap: spacing.sm,
  },
  modalOptionText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  modalRoot: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
  },
  pressed: {
    opacity: 0.78,
  },
  profileCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  profileEmail: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  profileName: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.lg,
  },
  rowIcon: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  rowLabel: {
    color: colors.text,
    flex: 1,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  rowLabelDestructive: {
    color: colors.error,
  },
  rowValue: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenTitle: {
    color: colors.text,
    fontSize: typography.size.brand,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
    lineHeight: typography.lineHeight.brand,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  sectionLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
  },
  sentryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  sentryButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
    letterSpacing: 0,
  },
  settingsPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.lg,
    minHeight: 122,
    padding: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statValue: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
  },
  titleBlock: {
    gap: spacing.xs,
  },
  topStatLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  topStatRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  topStats: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  topStatValue: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
    textAlign: 'right',
  },
  versionBlock: {
    alignItems: 'center',
  },
  versionText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
});

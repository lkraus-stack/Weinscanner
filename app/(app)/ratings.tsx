import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { RatingItem } from '@/components/ratings/RatingItem';
import {
  createEmptyRatingFormValue,
  RatingModal,
  type RatingFormValue,
} from '@/components/ratings/RatingModal';
import {
  type RatingListItem,
  type RatingsFilters,
  useRatings,
} from '@/hooks/useRatings';
import { deleteRating, updateRating } from '@/lib/ratings';
import { useToastStore } from '@/stores/toast-store';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type SortBy = RatingsFilters['sortBy'];
type StarFilter = RatingsFilters['minStars'];

const SORT_OPTIONS: { label: string; value: SortBy }[] = [
  { label: 'Neueste', value: 'newest' },
  { label: 'Beste', value: 'best' },
];

const STAR_FILTERS: { label: string; value?: StarFilter }[] = [
  { label: 'Alle' },
  { label: '5★', value: 5 },
  { label: '4★+', value: 4 },
  { label: '3★+', value: 3 },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

function ratingToFormValue(rating: RatingListItem | null): RatingFormValue {
  if (!rating) {
    return createEmptyRatingFormValue();
  }

  return {
    drankAt: rating.drank_at ?? createEmptyRatingFormValue().drankAt,
    notes: rating.notes ?? '',
    occasion: rating.occasion ?? '',
    stars: rating.stars ?? 0,
  };
}

function buildWineTitle(rating: RatingListItem | null) {
  const vintage = rating?.vintage;
  const wine = vintage?.wine;

  if (!vintage || !wine) {
    return 'Wein nicht verfügbar';
  }

  const baseTitle =
    wine.producer === wine.wine_name
      ? wine.producer
      : `${wine.producer} ${wine.wine_name}`;

  return `${baseTitle}, ${vintage.vintage_year}`;
}

export default function RatingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [minStars, setMinStars] = useState<StarFilter>();
  const [selectedRating, setSelectedRating] = useState<RatingListItem | null>(
    null
  );
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);
  const filters = useMemo(() => ({ minStars, sortBy }), [minStars, sortBy]);
  const ratingsQuery = useRatings(filters);
  const ratings = useMemo(
    () => ratingsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [ratingsQuery.data]
  );
  const isInitialLoading = ratingsQuery.isLoading;

  async function invalidateRatingCaches(scanId?: string | null) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ratings'] }),
      queryClient.invalidateQueries({ queryKey: ['history'] }),
      scanId
        ? queryClient.invalidateQueries({ queryKey: ['scan-detail', scanId] })
        : Promise.resolve(),
    ]);
  }

  const updateRatingMutation = useMutation({
    mutationFn: async (value: RatingFormValue) => {
      if (!selectedRating) {
        throw new Error('Bewertung fehlt.');
      }

      return updateRating(selectedRating.id, {
        drank_at: value.drankAt,
        notes: value.notes,
        occasion: value.occasion,
        stars: value.stars,
      });
    },
    onError: async (error: unknown, value) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bewertung konnte nicht gespeichert werden', getErrorMessage(error), [
        { text: 'Abbrechen', style: 'cancel' },
        {
          onPress: () => updateRatingMutation.mutate(value),
          text: 'Erneut versuchen',
        },
      ]);
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsRatingModalVisible(false);
      showToast('Bewertung aktualisiert');
      await invalidateRatingCaches(selectedRating?.scan?.id);
    },
  });

  const deleteRatingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRating) {
        throw new Error('Bewertung fehlt.');
      }

      await deleteRating(selectedRating.id);
    },
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bewertung konnte nicht gelöscht werden', getErrorMessage(error));
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsActionModalVisible(false);
      showToast('Bewertung gelöscht');
      await invalidateRatingCaches(selectedRating?.scan?.id);
      setSelectedRating(null);
    },
  });

  const loadMore = useCallback(() => {
    if (ratingsQuery.hasNextPage && !ratingsQuery.isFetchingNextPage) {
      ratingsQuery.fetchNextPage();
    }
  }, [ratingsQuery]);

  const openRatingDetail = useCallback(
    (rating: RatingListItem) => {
      if (rating.scan?.id) {
        router.push({
          pathname: '/wine-detail',
          params: { scanId: rating.scan.id },
        });
        return;
      }

      Alert.alert('Detail-View kommt in Sprint 13');
    },
    [router]
  );

  const openActions = useCallback(async (rating: RatingListItem) => {
    await Haptics.selectionAsync();
    setSelectedRating(rating);
    setIsActionModalVisible(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RatingListItem>) => (
      <RatingItem item={item} onMore={openActions} onPress={openRatingDetail} />
    ),
    [openActions, openRatingDetail]
  );

  const renderFooter = useCallback(() => {
    if (!ratingsQuery.isFetchingNextPage) {
      return <View style={styles.footerSpacer} />;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }, [ratingsQuery.isFetchingNextPage]);

  const listEmptyComponent = useCallback(() => {
    if (isInitialLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Bewertungen werden geladen...</Text>
        </View>
      );
    }

    if (ratingsQuery.isError) {
      return (
        <EmptyState
          cta={{
            label: 'Erneut versuchen',
            onPress: () => ratingsQuery.refetch(),
          }}
          description="Bitte versuche es gleich noch einmal."
          icon="alert-circle-outline"
          title="Bewertungen konnten nicht geladen werden"
        />
      );
    }

    return (
      <EmptyState
        cta={{
          label: 'Wein scannen und bewerten',
          onPress: () => router.push('/(app)/scan'),
        }}
        description="Bewertete Weine sammeln sich hier mit Sternen, Notizen und Anlass."
        icon="star-outline"
        title="Noch keine Bewertungen"
      />
    );
  }, [isInitialLoading, ratingsQuery, router]);

  function editSelectedRating() {
    setIsActionModalVisible(false);
    setIsRatingModalVisible(true);
  }

  function confirmDeleteSelectedRating() {
    setIsActionModalVisible(false);
    Alert.alert(
      'Bewertung löschen?',
      'Diese Bewertung wird dauerhaft aus deinem Kellerbuch entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          onPress: () => deleteRatingMutation.mutate(),
          style: 'destructive',
          text: 'Bewertung löschen',
        },
      ]
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Kellerbuch</Text>
        <Text style={styles.title}>Bewertet</Text>

        <View style={styles.segmentedControl}>
          {SORT_OPTIONS.map((option) => {
            const selected = sortBy === option.value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => setSortBy(option.value)}
                style={[
                  styles.segmentedOption,
                  selected && styles.segmentedOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.segmentedText,
                    selected && styles.segmentedTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.filterRow}>
          {STAR_FILTERS.map((filter) => {
            const selected = minStars === filter.value;

            return (
              <Pressable
                key={filter.label}
                accessibilityRole="button"
                onPress={() => setMinStars(filter.value)}
                style={[
                  styles.filterPill,
                  selected && styles.filterPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selected && styles.filterPillTextSelected,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlashList
        contentContainerStyle={styles.listContent}
        data={ratings}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.45}
        refreshControl={
          <RefreshControl
            onRefresh={ratingsQuery.refetch}
            refreshing={
              ratingsQuery.isRefetching && !ratingsQuery.isFetchingNextPage
            }
            tintColor={colors.primary}
          />
        }
        renderItem={renderItem}
      />

      <RatingActionsModal
        isDeleting={deleteRatingMutation.isPending}
        onCancel={() => setIsActionModalVisible(false)}
        onDelete={confirmDeleteSelectedRating}
        onEdit={editSelectedRating}
        visible={isActionModalVisible}
      />

      <RatingModal
        initialValue={ratingToFormValue(selectedRating)}
        isSaving={updateRatingMutation.isPending}
        onClose={() => setIsRatingModalVisible(false)}
        onSubmit={(value) => updateRatingMutation.mutate(value)}
        submitLabel="Aktualisieren"
        visible={isRatingModalVisible}
        wineTitle={buildWineTitle(selectedRating)}
      />
    </SafeAreaView>
  );
}

function RatingActionsModal({
  isDeleting,
  onCancel,
  onDelete,
  onEdit,
  visible,
}: {
  isDeleting: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onEdit: () => void;
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
          accessibilityLabel="Bewertungsaktionen schließen"
          onPress={onCancel}
          style={styles.modalBackdrop}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Bewertung</Text>
          <Text style={styles.modalDescription}>
            Passe deine Notiz an oder lösche diese Bewertung.
          </Text>

          <View style={styles.modalOptions}>
            <ModalOption
              icon="create-outline"
              label="Bearbeiten"
              onPress={onEdit}
            />
            <ModalOption
              destructive
              icon="trash-outline"
              isBusy={isDeleting}
              label="Löschen"
              onPress={onDelete}
            />
          </View>

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
  destructive,
  icon,
  isBusy,
  label,
  onPress,
}: {
  destructive?: boolean;
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
      <Ionicons
        color={destructive ? colors.error : colors.primaryDark}
        name={icon}
        size={22}
      />
      <Text
        style={[
          styles.modalOptionText,
          destructive && styles.modalOptionTextDestructive,
        ]}
      >
        {label}
      </Text>
      {isBusy ? <ActivityIndicator color={colors.error} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    minHeight: 50,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  disabled: {
    opacity: 0.55,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  filterPill: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  filterPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  filterPillTextSelected: {
    color: colors.white,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footerLoader: {
    alignItems: 'center',
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  footerSpacer: {
    height: 112,
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  listContent: {
    paddingBottom: 110,
  },
  loadingState: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 300,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
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
  modalOptionTextDestructive: {
    color: colors.error,
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
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  segmentedControl: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.xs,
  },
  segmentedOption: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  segmentedOptionSelected: {
    backgroundColor: colors.surface,
  },
  segmentedText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  segmentedTextSelected: {
    color: colors.primaryDark,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.brand,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
    lineHeight: typography.lineHeight.brand,
  },
});

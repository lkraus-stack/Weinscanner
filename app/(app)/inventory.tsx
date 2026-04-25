import { Ionicons } from '@expo/vector-icons';
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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import {
  AddInventoryModal,
  createEmptyInventoryFormValue,
  type InventoryFormValue,
} from '@/components/inventory/AddInventoryModal';
import { InventoryItem } from '@/components/inventory/InventoryItem';
import {
  type InventoryListItem,
  useInventory,
} from '@/hooks/useInventory';
import { useInventoryStats } from '@/hooks/useInventoryStats';
import { usePreferences } from '@/hooks/usePreferences';
import {
  decrementQuantity,
  deleteInventoryItem,
  updateInventoryItem,
} from '@/lib/inventory';
import { useToastStore } from '@/stores/toast-store';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('de-DE', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })} €`;
}

function inventoryItemToFormValue(item: InventoryListItem | null): InventoryFormValue {
  if (!item) {
    return createEmptyInventoryFormValue();
  }

  return {
    notes: item.notes ?? '',
    purchasePrice: item.purchase_price,
    purchasedAt: item.purchased_at,
    quantity: Math.max(item.quantity ?? 1, 1),
    storageLocation: item.storage_location ?? '',
  };
}

function buildWineTitle(item: InventoryListItem | null) {
  const vintage = item?.vintage;
  const wine = vintage?.wine;

  if (!vintage || !wine) {
    return 'Bestand bearbeiten';
  }

  const baseTitle =
    wine.producer === wine.wine_name
      ? wine.producer
      : `${wine.producer} ${wine.wine_name}`;

  return `${baseTitle}, ${vintage.vintage_year}`;
}

export default function InventoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [storageLocation, setStorageLocation] = useState<string | undefined>();
  const [selectedItem, setSelectedItem] = useState<InventoryListItem | null>(
    null
  );
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const preferencesQuery = usePreferences();
  const inventoryQuery = useInventory({
    hideEmptyInventory: preferencesQuery.preferences.hide_empty_inventory,
    storageLocation,
  });
  const statsQuery = useInventoryStats();
  const items = useMemo(
    () => inventoryQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [inventoryQuery.data]
  );
  const isInitialLoading = inventoryQuery.isLoading;
  const stats = statsQuery.data;
  const locations = stats?.storageLocations ?? [];
  const hasLocationFilter = Boolean(storageLocation);

  async function invalidateInventoryCaches(item?: InventoryListItem | null) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] }),
      item?.latestScanId
        ? queryClient.invalidateQueries({
            queryKey: ['scan-detail', item.latestScanId],
          })
        : Promise.resolve(),
    ]);
  }

  const decrementMutation = useMutation({
    mutationFn: (item: InventoryListItem) => decrementQuantity(item.id),
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Menge konnte nicht geändert werden', getErrorMessage(error));
    },
    onSuccess: async (_updatedItem, item) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Eine Flasche ausgetragen');
      await invalidateInventoryCaches(item);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (value: InventoryFormValue) => {
      if (!selectedItem) {
        throw new Error('Bestandseintrag fehlt.');
      }

      return updateInventoryItem(selectedItem.id, {
        notes: value.notes,
        purchase_price: value.purchasePrice,
        purchased_at: value.purchasedAt,
        quantity: value.quantity,
        storage_location: value.storageLocation,
      });
    },
    onError: async (error: unknown, value) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bestand konnte nicht gespeichert werden', getErrorMessage(error), [
        { text: 'Abbrechen', style: 'cancel' },
        {
          onPress: () => updateMutation.mutate(value),
          text: 'Erneut versuchen',
        },
      ]);
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditModalVisible(false);
      showToast('Bestand aktualisiert');
      await invalidateInventoryCaches(selectedItem);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) {
        throw new Error('Bestandseintrag fehlt.');
      }

      await deleteInventoryItem(selectedItem.id);
    },
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bestand konnte nicht gelöscht werden', getErrorMessage(error));
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsActionModalVisible(false);
      showToast('Bestand gelöscht');
      await invalidateInventoryCaches(selectedItem);
      setSelectedItem(null);
    },
  });

  const loadMore = useCallback(() => {
    if (inventoryQuery.hasNextPage && !inventoryQuery.isFetchingNextPage) {
      inventoryQuery.fetchNextPage();
    }
  }, [inventoryQuery]);

  const openActions = useCallback(async (item: InventoryListItem) => {
    await Haptics.selectionAsync();
    setSelectedItem(item);
    setIsActionModalVisible(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<InventoryListItem>) => (
      <InventoryItem
        item={item}
        onDrink={(inventoryItem) => decrementMutation.mutate(inventoryItem)}
        onMore={openActions}
      />
    ),
    [decrementMutation, openActions]
  );

  const renderFooter = useCallback(() => {
    if (!inventoryQuery.isFetchingNextPage) {
      return <View style={styles.footerSpacer} />;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }, [inventoryQuery.isFetchingNextPage]);

  const listEmptyComponent = useCallback(() => {
    if (isInitialLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Bestand wird geladen...</Text>
        </View>
      );
    }

    if (inventoryQuery.isError) {
      return (
        <EmptyState
          cta={{
            label: 'Erneut versuchen',
            onPress: () => inventoryQuery.refetch(),
          }}
          description="Bitte versuche es gleich noch einmal."
          icon="alert-circle-outline"
          title="Bestand konnte nicht geladen werden"
        />
      );
    }

    if (hasLocationFilter) {
      return (
        <EmptyState
          description="Für diesen Standort wurden keine Flaschen gefunden."
          icon="filter-outline"
          title="Keine Treffer"
        />
      );
    }

    return (
      <EmptyState
        cta={{
          label: 'Wein scannen',
          onPress: () => router.push('/(app)/scan'),
        }}
        description="Deine Flaschen und Lagerorte erscheinen hier, sobald du Weine zum Bestand hinzufügst."
        icon="cube-outline"
        title="Dein Bestand ist leer"
      />
    );
  }, [hasLocationFilter, inventoryQuery, isInitialLoading, router]);

  function editSelectedItem() {
    setIsActionModalVisible(false);
    setIsEditModalVisible(true);
  }

  function confirmDeleteSelectedItem() {
    setIsActionModalVisible(false);
    Alert.alert(
      'Bestand löschen?',
      'Dieser Bestandseintrag wird dauerhaft entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          onPress: () => deleteMutation.mutate(),
          style: 'destructive',
          text: 'Bestand löschen',
        },
      ]
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Kellerbuch</Text>
        <Text style={styles.title}>Bestand</Text>

        <View style={styles.statsGrid}>
          <StatCard
            label="Flaschen"
            value={String(stats?.totalBottles ?? 0)}
          />
          <StatCard
            label="Jahrgänge"
            value={String(stats?.vintageCount ?? 0)}
          />
          <StatCard
            label="Wert"
            value={formatCurrency(stats?.estimatedValue ?? 0)}
          />
          <StatCard label="Leer" value={String(stats?.emptyItems ?? 0)} />
        </View>
      </View>

      <View style={styles.filterShell}>
        <ScrollView
          contentContainerStyle={styles.filterContent}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <LocationPill
            label="Alle"
            onPress={() => setStorageLocation(undefined)}
            selected={!storageLocation}
          />
          {locations.map((location) => (
            <LocationPill
              key={location}
              label={location}
              onPress={() => setStorageLocation(location)}
              selected={storageLocation === location}
            />
          ))}
        </ScrollView>
      </View>

      <FlashList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.45}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              inventoryQuery.refetch();
              statsQuery.refetch();
            }}
            refreshing={
              (inventoryQuery.isRefetching || statsQuery.isRefetching) &&
              !inventoryQuery.isFetchingNextPage
            }
            tintColor={colors.primary}
          />
        }
        renderItem={renderItem}
      />

      <InventoryActionsModal
        isDeleting={deleteMutation.isPending}
        onCancel={() => setIsActionModalVisible(false)}
        onDelete={confirmDeleteSelectedItem}
        onEdit={editSelectedItem}
        visible={isActionModalVisible}
      />

      <AddInventoryModal
        initialValue={inventoryItemToFormValue(selectedItem)}
        isSaving={updateMutation.isPending}
        onClose={() => setIsEditModalVisible(false)}
        onSubmit={(value) => updateMutation.mutate(value)}
        submitLabel="Speichern"
        visible={isEditModalVisible}
        wineTitle={buildWineTitle(selectedItem)}
      />
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LocationPill({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.locationPill, selected && styles.locationPillSelected]}
    >
      <Text
        style={[
          styles.locationPillText,
          selected && styles.locationPillTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InventoryActionsModal({
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
          accessibilityLabel="Bestandsaktionen schließen"
          onPress={onCancel}
          style={styles.modalBackdrop}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Bestand</Text>
          <Text style={styles.modalDescription}>
            Bearbeite den Eintrag oder entferne ihn aus deinem Bestand.
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
    justifyContent: 'center',
    minHeight: 50,
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
  filterContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.screenX,
  },
  filterShell: {
    paddingBottom: spacing.sm,
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
  locationPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  locationPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationPillText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  locationPillTextSelected: {
    color: colors.white,
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
  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 72,
    padding: spacing.md,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statValue: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.brand,
    fontWeight: typography.weight.black,
    letterSpacing: 0,
    lineHeight: typography.lineHeight.brand,
  },
});

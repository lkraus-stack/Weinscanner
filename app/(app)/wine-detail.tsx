import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AddInventoryModal,
  createEmptyInventoryFormValue,
  type InventoryFormValue,
} from '@/components/inventory/AddInventoryModal';
import {
  createEmptyRatingFormValue,
  RatingModal,
  type RatingFormValue,
} from '@/components/ratings/RatingModal';
import { VintageYearPicker } from '@/components/scan/VintageYearPicker';
import { WineDetailSkeleton } from '@/components/skeletons/WineDetailSkeleton';
import { BottomSheet, SheetOption } from '@/components/ui/BottomSheet';
import { AromaGrid } from '@/components/wine-detail/AromaGrid';
import {
  type ScanDetail,
  type ScanDetailRating,
  useScanDetail,
} from '@/hooks/useScanDetail';
import { useWineVintages } from '@/hooks/useWineVintages';
import {
  addToInventory,
  findInventoryMatches,
  increaseInventoryQuantity,
  type InventoryRecord,
} from '@/lib/inventory';
import {
  getRatingForScan,
  type RatingRecord,
  saveRating,
  updateRating,
} from '@/lib/ratings';
import { supabase } from '@/lib/supabase';
import { useToastStore } from '@/stores/toast-store';
import { radii, spacing } from '@/theme/spacing';
import { useTheme, type ThemeColors } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

type InfoItem = {
  label: string;
  value: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Bitte versuche es noch einmal.';
}

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function valueOrUnavailable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 'Nicht verfügbar';
  }

  return String(value);
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function joinMeta(parts: (string | null | undefined)[]) {
  const values = parts.filter((part): part is string => Boolean(part));

  return values.length > 0 ? values.join(', ') : 'Nicht verfügbar';
}

function isRemoteUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function formatWineLabel(value: string | null | undefined) {
  if (!value) {
    return 'Nicht verfügbar';
  }

  if (value === 'suess') {
    return 'Süß';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatYearRange(start: number | null, end: number | null) {
  if (typeof start === 'number' && typeof end === 'number') {
    return `${start}-${end}`;
  }

  if (typeof start === 'number') {
    return `ab ${start}`;
  }

  if (typeof end === 'number') {
    return `bis ${end}`;
  }

  return 'Nicht verfügbar';
}

function formatCurrency(value: number) {
  return value.toLocaleString('de-DE', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

function formatPrice(min: number | null, max: number | null) {
  if (typeof min === 'number' && typeof max === 'number') {
    return `${formatCurrency(min)}-${formatCurrency(max)} €`;
  }

  if (typeof min === 'number') {
    return `ab ${formatCurrency(min)} €`;
  }

  if (typeof max === 'number') {
    return `bis ${formatCurrency(max)} €`;
  }

  return 'Nicht verfügbar';
}

function formatAlcohol(value: number | null) {
  if (typeof value !== 'number') {
    return 'Nicht verfügbar';
  }

  return `${value.toLocaleString('de-DE', {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  })} %`;
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return DATE_FORMATTER.format(new Date(value));
}

function buildTitle(detail: ScanDetail) {
  const vintage = detail.vintage;
  const wine = vintage?.wine;

  if (!vintage || !wine) {
    return 'Scan zu prüfen';
  }

  const baseTitle =
    wine.producer === wine.wine_name
      ? wine.producer
      : `${wine.producer} ${wine.wine_name}`;

  return `${baseTitle}, ${vintage.vintage_year}`;
}

function buildSubtitle(detail: ScanDetail) {
  const wine = detail.vintage?.wine;

  if (!wine) {
    return 'Foto gespeichert, Details fehlen noch';
  }

  return joinMeta([wine.region, wine.country]);
}

function buildDraftInfoItems(detail: ScanDetail): InfoItem[] {
  return [
    { label: 'Status', value: 'Zu prüfen' },
    { label: 'Gescannt', value: formatDate(detail.scannedAt) ?? 'Gerade eben' },
    {
      label: 'Weindaten',
      value: 'Noch offen',
    },
    {
      label: 'Jahrgang',
      value: 'Noch offen',
    },
  ];
}

function buildInfoItems(detail: ScanDetail): InfoItem[] {
  const vintage = detail.vintage;
  const wine = vintage?.wine;

  return [
    { label: 'Weingut', value: valueOrUnavailable(wine?.producer) },
    { label: 'Geschmack', value: formatWineLabel(wine?.taste_dryness) },
    { label: 'Rebsorte', value: valueOrUnavailable(wine?.grape_variety) },
    { label: 'Land', value: valueOrUnavailable(wine?.country) },
    { label: 'Region', value: valueOrUnavailable(wine?.region) },
    { label: 'Lage', value: joinMeta([wine?.sub_region, wine?.appellation]) },
    {
      label: 'Trinkfenster',
      value: vintage
        ? formatYearRange(
            vintage.drinking_window_start,
            vintage.drinking_window_end
          )
        : 'Nicht verfügbar',
    },
    {
      label: 'Preis',
      value: vintage
        ? formatPrice(vintage.price_min_eur, vintage.price_max_eur)
        : 'Nicht verfügbar',
    },
    {
      label: 'Alkohol',
      value: vintage ? formatAlcohol(vintage.alcohol_percent) : 'Nicht verfügbar',
    },
  ];
}

function getVisibleRating(ratings: ScanDetailRating[]) {
  return (
    ratings.find((rating) => typeof rating.stars === 'number') ??
    ratings[0] ??
    null
  );
}

function ratingToFormValue(
  rating: RatingRecord | ScanDetailRating | null
): RatingFormValue {
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

function normalizeInventoryLocation(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase('de-DE') ?? '';
}

function findPreferredInventoryMatch(
  matches: InventoryRecord[],
  value: InventoryFormValue
) {
  const targetLocation = normalizeInventoryLocation(value.storageLocation);

  return (
    matches.find(
      (match) =>
        normalizeInventoryLocation(match.storage_location) === targetLocation
    ) ??
    matches[0] ??
    null
  );
}

async function reassignScanVintage({
  scanId,
  targetVintageYear,
}: {
  scanId: string;
  targetVintageYear: number;
}) {
  const { error } = await supabase.rpc('reassign_scan_vintage', {
    scan_id: scanId,
    target_vintage_year: targetVintageYear,
  });

  if (error) {
    throw error;
  }
}

async function deleteScan(detail: ScanDetail) {
  const { error: ratingsError } = await supabase
    .from('ratings')
    .update({ scan_id: null })
    .eq('scan_id', detail.id);

  if (ratingsError) {
    throw ratingsError;
  }

  const { error: scanError } = await supabase
    .from('scans')
    .delete()
    .eq('id', detail.id);

  if (scanError) {
    throw scanError;
  }

  const storagePaths = [detail.labelImagePath, detail.bottleImagePath].filter(
    (path): path is string => Boolean(path && !isRemoteUrl(path))
  );

  if (storagePaths.length === 0) {
    return;
  }

  const { error: storageError } = await supabase.storage
    .from('wine-labels')
    .remove(storagePaths);

  if (storageError) {
    console.warn('Storage-Cleanup fuer geloeschten Scan fehlgeschlagen:', storageError.message);
  }
}

function useWineDetailStyles() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return { colors, styles };
}

export default function WineDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { styles } = useWineDetailStyles();
  const params = useLocalSearchParams<{ scanId?: string }>();
  const scanId = normalizeParam(params.scanId);
  const scanDetailQuery = useScanDetail(scanId);

  return (
    <View style={styles.screen}>
      <DetailHeader insetTop={insets.top} onBack={() => router.back()} />

      {!scanId ? (
        <CenterState
          description="Diese Detailansicht wurde ohne Scan-ID geöffnet."
          icon="alert-circle-outline"
          title="Scan fehlt"
        />
      ) : null}

      {scanId && scanDetailQuery.isLoading ? (
        <WineDetailSkeleton paddingBottom={insets.bottom + 120} />
      ) : null}

      {scanId && scanDetailQuery.isError ? (
        <CenterState
          ctaLabel="Erneut versuchen"
          description={
            scanDetailQuery.error.message ||
            'Die Detaildaten konnten nicht geladen werden.'
          }
          icon="warning-outline"
          onPress={() => scanDetailQuery.refetch()}
          title="Detail konnte nicht geladen werden"
        />
      ) : null}

      {scanId && scanDetailQuery.data ? (
        <WineDetailContent
          detail={scanDetailQuery.data}
          paddingBottom={insets.bottom + 120}
        />
      ) : null}
    </View>
  );
}

function DetailHeader({
  insetTop,
  onBack,
}: {
  insetTop: number;
  onBack: () => void;
}) {
  const { colors, styles } = useWineDetailStyles();

  return (
    <View style={[styles.header, { paddingTop: insetTop + spacing.sm }]}>
      <Pressable
        accessibilityLabel="Zurück"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.headerButton}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.headerButtonSpacer} />
    </View>
  );
}

function WineDetailContent({
  detail,
  paddingBottom,
}: {
  detail: ScanDetail;
  paddingBottom: number;
}) {
  const { colors, styles } = useWineDetailStyles();
  const queryClient = useQueryClient();
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const imageUrl = detail.labelImageUrl ?? detail.bottleImageUrl;
  const rating = getVisibleRating(detail.ratings);
  const vintage = detail.vintage;
  const isDraft = !vintage;
  const wineId = vintage?.wine_id ?? null;
  const currentVintageYear = vintage?.vintage_year ?? null;
  const vintagesQuery = useWineVintages(wineId);
  const knownYears = useMemo(
    () => vintagesQuery.data?.map((option) => option.vintage_year) ?? [],
    [vintagesQuery.data]
  );
  const [isCorrectionModalVisible, setIsCorrectionModalVisible] =
    useState(false);
  const [isInventoryModalVisible, setIsInventoryModalVisible] = useState(false);
  const [isInventoryDuplicateModalVisible, setIsInventoryDuplicateModalVisible] =
    useState(false);
  const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);
  const [activeRating, setActiveRating] = useState<
    RatingRecord | ScanDetailRating | null
  >(rating);
  const [ratingInitialValue, setRatingInitialValue] =
    useState<RatingFormValue>(() => ratingToFormValue(rating));
  const [isVintageModalVisible, setIsVintageModalVisible] = useState(false);
  const [selectedVintageYear, setSelectedVintageYear] = useState<number | null>(
    currentVintageYear
  );
  const [pendingInventoryValue, setPendingInventoryValue] =
    useState<InventoryFormValue | null>(null);
  const [inventoryMatches, setInventoryMatches] = useState<InventoryRecord[]>(
    []
  );
  const inventoryInitialValue = useMemo(
    () => createEmptyInventoryFormValue(),
    []
  );
  const hasDescription = Boolean(
    hasText(vintage?.description_short) || hasText(vintage?.description_long)
  );
  const hasRecommendation = Boolean(
    hasText(vintage?.serving_temperature) || hasText(vintage?.food_pairing)
  );
  const ratingSubmitLabel = activeRating ? 'Aktualisieren' : 'Speichern';

  useEffect(() => {
    if (isVintageModalVisible) {
      setSelectedVintageYear(currentVintageYear);
    }
  }, [currentVintageYear, isVintageModalVisible]);

  const reassignVintageMutation = useMutation({
    mutationFn: (targetVintageYear: number) =>
      reassignScanVintage({
        scanId: detail.id,
        targetVintageYear,
      }),
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Jahrgang konnte nicht geändert werden', getErrorMessage(error));
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsVintageModalVisible(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['scan-detail', detail.id] }),
        queryClient.invalidateQueries({ queryKey: ['history'] }),
        queryClient.invalidateQueries({ queryKey: ['wine-vintages', wineId] }),
      ]);
    },
  });

  const deleteScanMutation = useMutation({
    mutationFn: () => deleteScan(detail),
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Scan konnte nicht gelöscht werden', getErrorMessage(error));
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['history'] }),
        queryClient.invalidateQueries({ queryKey: ['ratings'] }),
      ]);
      router.replace('/(app)');
    },
  });

  const saveRatingMutation = useMutation({
    mutationFn: async (value: RatingFormValue) => {
      if (!vintage) {
        throw new Error('Jahrgang fehlt.');
      }

      if (activeRating) {
        return updateRating(activeRating.id, {
          drank_at: value.drankAt,
          notes: value.notes,
          occasion: value.occasion,
          stars: value.stars,
        });
      }

      return saveRating({
        drankAt: value.drankAt,
        notes: value.notes,
        occasion: value.occasion,
        scanId: detail.id,
        stars: value.stars,
        vintageId: vintage.id,
      });
    },
    onError: async (error: unknown, value) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bewertung konnte nicht gespeichert werden', getErrorMessage(error), [
        { text: 'Abbrechen', style: 'cancel' },
        {
          onPress: () => saveRatingMutation.mutate(value),
          text: 'Erneut versuchen',
        },
      ]);
    },
    onSuccess: async (savedRating) => {
      const wasUpdate = Boolean(activeRating);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setActiveRating(savedRating);
      setRatingInitialValue(ratingToFormValue(savedRating));
      setIsRatingModalVisible(false);
      showToast(wasUpdate ? 'Bewertung aktualisiert' : 'Bewertung gespeichert');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['scan-detail', detail.id] }),
        queryClient.invalidateQueries({ queryKey: ['history'] }),
        queryClient.invalidateQueries({ queryKey: ['ratings'] }),
      ]);
    },
  });

  async function invalidateInventoryCaches() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['scan-detail', detail.id] }),
    ]);
  }

  const addInventoryMutation = useMutation({
    mutationFn: async (value: InventoryFormValue) => {
      if (!vintage) {
        throw new Error('Jahrgang fehlt.');
      }

      return addToInventory({
        notes: value.notes,
        purchasePrice: value.purchasePrice,
        purchasedAt: value.purchasedAt,
        quantity: value.quantity,
        storageLocation: value.storageLocation,
        vintageId: vintage.id,
      });
    },
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bestand konnte nicht gespeichert werden', getErrorMessage(error));
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsInventoryModalVisible(false);
      setIsInventoryDuplicateModalVisible(false);
      setPendingInventoryValue(null);
      setInventoryMatches([]);
      showToast('Zum Bestand hinzugefügt');
      await invalidateInventoryCaches();
    },
  });

  const increaseInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!pendingInventoryValue) {
        throw new Error('Bestandsdaten fehlen.');
      }

      const match = findPreferredInventoryMatch(
        inventoryMatches,
        pendingInventoryValue
      );

      if (!match) {
        throw new Error('Bestandseintrag wurde nicht gefunden.');
      }

      return increaseInventoryQuantity({
        delta: pendingInventoryValue.quantity,
        itemId: match.id,
      });
    },
    onError: async (error: unknown) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bestand konnte nicht erhöht werden', getErrorMessage(error));
    },
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsInventoryDuplicateModalVisible(false);
      setPendingInventoryValue(null);
      setInventoryMatches([]);
      showToast('Bestand aktualisiert');
      await invalidateInventoryCaches();
    },
  });

  async function openRatingModal() {
    try {
      await Haptics.selectionAsync();
      const existingRating = await getRatingForScan(detail.id);
      const nextRating = existingRating ?? rating;
      setActiveRating(nextRating);
      setRatingInitialValue(ratingToFormValue(nextRating));
      setIsRatingModalVisible(true);
    } catch (error: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bewertung konnte nicht geladen werden', getErrorMessage(error));
    }
  }

  async function openInventoryModal() {
    await Haptics.selectionAsync();
    setIsInventoryModalVisible(true);
  }

  async function submitInventory(value: InventoryFormValue) {
    if (!vintage) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bestand konnte nicht gespeichert werden', 'Jahrgang fehlt.');
      return;
    }

    try {
      const matches = await findInventoryMatches(vintage.id);

      if (matches.length > 0) {
        setPendingInventoryValue(value);
        setInventoryMatches(matches);
        setIsInventoryModalVisible(false);
        setIsInventoryDuplicateModalVisible(true);
        return;
      }

      addInventoryMutation.mutate(value);
    } catch (error: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Bestand konnte nicht geprüft werden', getErrorMessage(error));
    }
  }

  function createNewInventoryItemFromDuplicate() {
    if (!pendingInventoryValue) {
      return;
    }

    addInventoryMutation.mutate(pendingInventoryValue);
  }

  async function openCorrectionModal() {
    await Haptics.selectionAsync();
    setIsCorrectionModalVisible(true);
  }

  async function openVintageModal() {
    await Haptics.selectionAsync();
    setIsCorrectionModalVisible(false);
    setSelectedVintageYear(currentVintageYear);
    setIsVintageModalVisible(true);
  }

  function confirmDeleteScan() {
    setIsCorrectionModalVisible(false);
    Alert.alert(
      'Scan löschen?',
      detail.vintage
        ? 'Der Scan wird aus deinem Verlauf entfernt. Wein und Jahrgang bleiben erhalten.'
        : 'Der Entwurf wird aus deinem Verlauf entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          onPress: () => deleteScanMutation.mutate(),
          style: 'destructive',
          text: 'Scan löschen',
        },
      ]
    );
  }

  function reidentifyWine() {
    setIsCorrectionModalVisible(false);
    router.push('/(app)/scan');
  }

  async function openDraftReview() {
    if (!detail.labelImagePath || !detail.labelImageUrl) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Foto fehlt',
        'Dieser Entwurf hat kein abrufbares Etikett-Foto.'
      );
      return;
    }

    await Haptics.selectionAsync();
    router.push({
      pathname: '/scan-confirm',
      params: {
        draftScanId: detail.id,
        secondarySignedUrl: detail.bottleImageUrl ?? '',
        secondaryStoragePath: detail.bottleImagePath ?? '',
        signedUrl: detail.labelImageUrl,
        storagePath: detail.labelImagePath,
      },
    });
  }

  function saveVintageReassignment() {
    if (!selectedVintageYear) {
      return;
    }

    if (selectedVintageYear === currentVintageYear) {
      setIsVintageModalVisible(false);
      return;
    }

    reassignVintageMutation.mutate(selectedVintageYear);
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.photoFrame}>
          {imageUrl ? (
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: imageUrl }}
              style={styles.photo}
              transition={160}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="wine-outline" size={42} color={colors.primaryDark} />
            </View>
          )}
        </Animated.View>

        <PhotoGallery detail={detail} />

        <View style={styles.summary}>
          <Text style={styles.title}>{buildTitle(detail)}</Text>
          <Text style={styles.subtitle}>{buildSubtitle(detail)}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, isDraft && styles.draftStatusPill]}>
              <Ionicons
                name={isDraft ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                size={15}
                color={isDraft ? colors.warning : colors.success}
              />
              <Text style={styles.statusPillText}>
                {isDraft ? 'Zu prüfen' : 'Gespeichert'}
              </Text>
            </View>
            {formatDate(detail.scannedAt) ? (
              <Text style={styles.scannedDate}>
                {formatDate(detail.scannedAt)}
              </Text>
            ) : null}
          </View>
          {rating ? <RatingSummary rating={rating} /> : null}
        </View>

        <Section title="Steckbrief">
          <InfoGrid items={isDraft ? buildDraftInfoItems(detail) : buildInfoItems(detail)} />
        </Section>

        {vintage?.aromas.length ? (
          <Section title="Aromen">
            <AromaGrid aromas={vintage.aromas} />
          </Section>
        ) : null}

        {hasDescription ? (
          <Section title="Charakter">
            <View style={styles.descriptionPanel}>
              {hasText(vintage?.description_short) ? (
                <Text style={styles.descriptionLead}>
                  {vintage?.description_short}
                </Text>
              ) : null}
              {hasText(vintage?.description_long) ? (
                <Text style={styles.descriptionBody}>
                  {vintage?.description_long}
                </Text>
              ) : null}
            </View>
          </Section>
        ) : null}

        {hasRecommendation ? (
          <Section title="Genuss-Empfehlung">
            <View style={styles.recommendationPanel}>
              {hasText(vintage?.serving_temperature) ? (
                <RecommendationRow
                  icon="thermometer-outline"
                  label="Serviertemperatur"
                  value={vintage?.serving_temperature ?? ''}
                />
              ) : null}
              {hasText(vintage?.food_pairing) ? (
                <RecommendationRow
                  icon="restaurant-outline"
                  label="Passt zu"
                  value={vintage?.food_pairing ?? ''}
                />
              ) : null}
            </View>
          </Section>
        ) : null}

        {hasText(vintage?.vinification) ? (
          <Section title="Ausbau">
            <View style={styles.descriptionPanel}>
              <Text style={styles.descriptionBody}>{vintage?.vinification}</Text>
            </View>
          </Section>
        ) : null}

        {isDraft ? (
          <DraftDetailActions
            isBusy={deleteScanMutation.isPending}
            onDelete={confirmDeleteScan}
            onReview={openDraftReview}
            onScanAgain={reidentifyWine}
          />
        ) : (
          <DetailActions
            isBusy={
              reassignVintageMutation.isPending ||
              deleteScanMutation.isPending ||
              saveRatingMutation.isPending ||
              addInventoryMutation.isPending ||
              increaseInventoryMutation.isPending
            }
            onCorrect={openCorrectionModal}
            onInventory={openInventoryModal}
            onRate={openRatingModal}
          />
        )}
      </ScrollView>

      <AddInventoryModal
        initialValue={inventoryInitialValue}
        isSaving={addInventoryMutation.isPending}
        onClose={() => setIsInventoryModalVisible(false)}
        onSubmit={submitInventory}
        visible={isInventoryModalVisible}
        wineTitle={buildTitle(detail)}
      />

      <RatingModal
        initialValue={ratingInitialValue}
        isSaving={saveRatingMutation.isPending}
        onClose={() => setIsRatingModalVisible(false)}
        onSubmit={(value) => saveRatingMutation.mutate(value)}
        submitLabel={ratingSubmitLabel}
        visible={isRatingModalVisible}
        wineTitle={buildTitle(detail)}
      />

      <CorrectionModal
        isDeleting={deleteScanMutation.isPending}
        onCancel={() => setIsCorrectionModalVisible(false)}
        onDelete={confirmDeleteScan}
        onOpenVintage={openVintageModal}
        onReidentify={reidentifyWine}
        visible={isCorrectionModalVisible}
      />

      <InventoryDuplicateModal
        isSaving={
          addInventoryMutation.isPending || increaseInventoryMutation.isPending
        }
        matches={inventoryMatches}
        onCancel={() => setIsInventoryDuplicateModalVisible(false)}
        onCreateNew={createNewInventoryItemFromDuplicate}
        onIncrease={() => increaseInventoryMutation.mutate()}
        pendingValue={pendingInventoryValue}
        visible={isInventoryDuplicateModalVisible}
      />

      <VintageReassignModal
        currentVintageYear={currentVintageYear}
        isLoadingYears={vintagesQuery.isLoading}
        isSaving={reassignVintageMutation.isPending}
        knownYears={knownYears}
        onCancel={() => setIsVintageModalVisible(false)}
        onChange={setSelectedVintageYear}
        onSave={saveVintageReassignment}
        value={selectedVintageYear}
        visible={isVintageModalVisible}
      />
    </>
  );
}

function RatingSummary({ rating }: { rating: ScanDetailRating }) {
  const { colors, styles } = useWineDetailStyles();
  const stars = typeof rating.stars === 'number' ? rating.stars : 0;
  const drankAt = formatDate(rating.drank_at);
  const meta = [rating.occasion, drankAt].filter(Boolean).join(' · ');

  return (
    <View style={styles.ratingCard}>
      <View style={styles.ratingRow}>
        <View style={styles.stars}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Ionicons
              key={index}
              name={index < stars ? 'star' : 'star-outline'}
              size={18}
              color={colors.warning}
            />
          ))}
        </View>
        <Text style={styles.ratingLabel}>deine Bewertung</Text>
      </View>
      {meta ? <Text style={styles.ratingMeta}>{meta}</Text> : null}
      {rating.notes ? <Text style={styles.ratingNotes}>{rating.notes}</Text> : null}
    </View>
  );
}

function PhotoGallery({ detail }: { detail: ScanDetail }) {
  const { styles } = useWineDetailStyles();
  const photos = [
    {
      label: 'Etikett',
      path: detail.labelImagePath,
      url: detail.labelImageUrl,
    },
    {
      label: 'Rückseite',
      path: detail.bottleImagePath,
      url: detail.bottleImageUrl,
    },
  ].filter((photo) => Boolean(photo.url));

  if (photos.length < 2) {
    return null;
  }

  return (
    <View style={styles.galleryRow}>
      {photos.map((photo) => (
        <View
          key={`${photo.label}-${photo.path ?? photo.url ?? ''}`}
          style={styles.galleryItem}
        >
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: photo.url ?? '' }}
            style={styles.galleryImage}
          />
          <Text style={styles.galleryLabel}>{photo.label}</Text>
        </View>
      ))}
    </View>
  );
}

function RecommendationRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors, styles } = useWineDetailStyles();

  return (
    <View style={styles.recommendationRow}>
      <View style={styles.recommendationIcon}>
        <Ionicons name={icon} size={20} color={colors.primaryDark} />
      </View>
      <View style={styles.recommendationText}>
        <Text style={styles.recommendationLabel}>{label}</Text>
        <Text style={styles.recommendationValue}>{value}</Text>
      </View>
    </View>
  );
}

function DraftDetailActions({
  isBusy,
  onDelete,
  onReview,
  onScanAgain,
}: {
  isBusy: boolean;
  onDelete: () => void;
  onReview: () => void;
  onScanAgain: () => void;
}) {
  const { colors, styles } = useWineDetailStyles();

  return (
    <View style={styles.draftActions}>
      <View style={styles.draftMessage}>
        <View style={styles.recommendationIcon}>
          <Ionicons name="create-outline" size={20} color={colors.primaryDark} />
        </View>
        <View style={styles.recommendationText}>
          <Text style={styles.recommendationLabel}>Scan ist gesichert</Text>
          <Text style={styles.recommendationValue}>
            Ergänze Weinname und Jahrgang, sobald du das Etikett geprüft hast.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onReview}
        style={[styles.actionButton, isBusy && styles.disabledAction]}
      >
        <Ionicons name="create-outline" size={20} color={colors.white} />
        <Text style={styles.actionButtonText}>Daten ergänzen</Text>
      </Pressable>

      <View style={styles.draftSecondaryActions}>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onScanAgain}
          style={styles.secondaryDraftButton}
        >
          <Ionicons name="camera-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.secondaryDraftButtonText}>Neu scannen</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onDelete}
          style={styles.secondaryDraftButton}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={[styles.secondaryDraftButtonText, styles.deleteText]}>
            Löschen
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DetailActions({
  isBusy,
  onCorrect,
  onInventory,
  onRate,
}: {
  isBusy: boolean;
  onCorrect: () => void;
  onInventory: () => void;
  onRate: () => void;
}) {
  const { colors, styles } = useWineDetailStyles();

  return (
    <View style={styles.actions}>
      <View style={styles.actionButtons}>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onRate}
          style={[styles.actionButton, isBusy && styles.disabledAction]}
        >
          <Ionicons name="star-outline" size={20} color={colors.white} />
          <Text style={styles.actionButtonText}>Bewerten</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onInventory}
          style={[styles.actionButton, isBusy && styles.disabledAction]}
        >
          <Ionicons name="wine-outline" size={20} color={colors.white} />
          <Text style={styles.actionButtonText}>Zum Bestand</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onCorrect}
        style={styles.correctionLink}
      >
        <Text style={styles.correctionLinkText}>Fehler korrigieren →</Text>
      </Pressable>
    </View>
  );
}

function CorrectionModal({
  isDeleting,
  onCancel,
  onDelete,
  onOpenVintage,
  onReidentify,
  visible,
}: {
  isDeleting: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onOpenVintage: () => void;
  onReidentify: () => void;
  visible: boolean;
}) {
  return (
    <BottomSheet
      description="Wähle, was an diesem Scan angepasst werden soll."
      onClose={onCancel}
      title="Fehler korrigieren"
      visible={visible}
    >
      <SheetOption
        icon="calendar-outline"
        label="Anderen Jahrgang zuweisen"
        onPress={onOpenVintage}
      />
      <SheetOption
        icon="scan-outline"
        label="Wein neu identifizieren"
        onPress={onReidentify}
      />
      <SheetOption
        destructive
        icon="trash-outline"
        isBusy={isDeleting}
        label="Scan löschen"
        onPress={onDelete}
      />
      <SheetOption icon="close-outline" label="Abbrechen" onPress={onCancel} />
    </BottomSheet>
  );
}

function InventoryDuplicateModal({
  isSaving,
  matches,
  onCancel,
  onCreateNew,
  onIncrease,
  pendingValue,
  visible,
}: {
  isSaving: boolean;
  matches: InventoryRecord[];
  onCancel: () => void;
  onCreateNew: () => void;
  onIncrease: () => void;
  pendingValue: InventoryFormValue | null;
  visible: boolean;
}) {
  const { styles } = useWineDetailStyles();
  const preferredMatch = pendingValue
    ? findPreferredInventoryMatch(matches, pendingValue)
    : null;
  const locationLabel =
    preferredMatch?.storage_location?.trim() || 'ohne Standort';

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Bestandsauswahl schließen"
          onPress={onCancel}
          style={styles.modalBackdrop}
        />
        <View style={styles.bottomSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Schon im Bestand</Text>
          <Text style={styles.modalDescription}>
            Dieser Jahrgang liegt bereits in deinem Bestand. Erhöhe den Eintrag
            {` ${locationLabel} `}oder lege einen neuen Standort an.
          </Text>

          <View style={styles.modalOptions}>
            <ModalOption
              icon="add-circle-outline"
              isBusy={isSaving}
              label="Menge erhöhen"
              onPress={onIncrease}
            />
            <ModalOption
              icon="albums-outline"
              isBusy={isSaving}
              label="Neuen Eintrag anlegen"
              onPress={onCreateNew}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onCancel}
            style={styles.modalCancelButton}
          >
            <Text style={styles.modalCancelText}>Abbrechen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function VintageReassignModal({
  currentVintageYear,
  isLoadingYears,
  isSaving,
  knownYears,
  onCancel,
  onChange,
  onSave,
  value,
  visible,
}: {
  currentVintageYear: number | null;
  isLoadingYears: boolean;
  isSaving: boolean;
  knownYears: number[];
  onCancel: () => void;
  onChange: (value: number | null) => void;
  onSave: () => void;
  value: number | null;
  visible: boolean;
}) {
  const { colors, styles } = useWineDetailStyles();
  const saveDisabled = !value || value === currentVintageYear || isSaving;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Jahrgang ändern schließen"
          onPress={onCancel}
          style={styles.modalBackdrop}
        />
        <View style={[styles.bottomSheet, styles.vintageSheet]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Anderen Jahrgang zuweisen</Text>
              <Text style={styles.modalDescription}>
                Der Scan wird auf den gewählten Jahrgang gesetzt.
              </Text>
            </View>
            <Pressable onPress={onCancel} style={styles.modalCloseButton}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          {isLoadingYears ? (
            <View style={styles.vintageLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.vintageLoadingText}>
                Jahrgänge werden geladen...
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.vintagePickerContent}
              showsVerticalScrollIndicator={false}
            >
              <VintageYearPicker
                knownYears={knownYears}
                onChange={onChange}
                suggestedYear={currentVintageYear}
                value={value}
              />
            </ScrollView>
          )}

          <View style={styles.modalActionRow}>
            <Pressable onPress={onCancel} style={styles.secondaryModalButton}>
              <Text style={styles.secondaryModalButtonText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              disabled={saveDisabled}
              onPress={onSave}
              style={[
                styles.primaryModalButton,
                saveDisabled && styles.disabledAction,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryModalButtonText}>Speichern</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModalOption({
  destructive = false,
  icon,
  isBusy = false,
  label,
  onPress,
}: {
  destructive?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  isBusy?: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors, styles } = useWineDetailStyles();
  const color = destructive ? colors.error : colors.primaryDark;

  return (
    <Pressable
      disabled={isBusy}
      onPress={onPress}
      style={[styles.modalOption, isBusy && styles.disabledAction]}
    >
      <View style={styles.modalOptionIcon}>
        {isBusy ? (
          <ActivityIndicator color={color} />
        ) : (
          <Ionicons name={icon} size={20} color={color} />
        )}
      </View>
      <Text
        style={[
          styles.modalOptionText,
          destructive && styles.modalOptionTextDestructive,
        ]}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { styles } = useWineDetailStyles();

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

function InfoGrid({ items }: { items: InfoItem[] }) {
  const { styles } = useWineDetailStyles();

  return (
    <View style={styles.infoGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.infoCell}>
          <Text style={styles.infoLabel}>{item.label}</Text>
          <Text style={styles.infoValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function CenterState({
  ctaLabel,
  description,
  icon,
  onPress,
  title,
}: {
  ctaLabel?: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  title: string;
}) {
  const { colors, styles } = useWineDetailStyles();

  return (
    <View style={styles.centerState}>
      <View style={styles.centerIconShell}>
        <Ionicons name={icon} size={34} color={colors.primaryDark} />
      </View>
      <View style={styles.centerCopy}>
        <Text style={styles.centerTitle}>{title}</Text>
        <Text style={styles.centerDescription}>{description}</Text>
      </View>
      {ctaLabel && onPress ? (
        <Pressable onPress={onPress} style={styles.centerButton}>
          <Text style={styles.centerButtonText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  bottomSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.lg,
    maxHeight: '88%',
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  centerButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 168,
    paddingHorizontal: spacing.xl,
  },
  centerButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  centerCopy: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  centerDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    maxWidth: 320,
    textAlign: 'center',
  },
  centerIconShell: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xxl,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
  },
  centerTitle: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.xl,
    textAlign: 'center',
  },
  content: {
    gap: spacing.xxl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },
  correctionLink: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  correctionLinkText: {
    color: colors.primaryDark,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  descriptionBody: {
    color: colors.text,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
  },
  descriptionLead: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.extraBold,
    lineHeight: typography.lineHeight.lg,
  },
  descriptionPanel: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  disabledAction: {
    opacity: 0.55,
  },
  deleteText: {
    color: colors.error,
  },
  draftActions: {
    gap: spacing.md,
  },
  draftMessage: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  draftSecondaryActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  draftStatusPill: {
    borderColor: colors.warning,
  },
  galleryImage: {
    height: 74,
    width: '100%',
  },
  galleryItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    overflow: 'hidden',
    padding: spacing.xs,
  },
  galleryLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extraBold,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  galleryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: -spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerButtonSpacer: {
    height: 44,
    width: 44,
  },
  infoCell: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 78,
    minWidth: 132,
    padding: spacing.md,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
    lineHeight: typography.lineHeight.base,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalCancelButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  modalCancelText: {
    color: colors.primaryDark,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  modalDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 4,
    width: 48,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  modalOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
  },
  modalOptionIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
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
  modalOptions: {
    gap: spacing.sm,
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
    lineHeight: typography.lineHeight.lg,
  },
  photo: {
    height: '100%',
    width: '100%',
  },
  photoFrame: {
    alignSelf: 'center',
    aspectRatio: 4 / 5,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    width: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    flex: 1,
    justifyContent: 'center',
  },
  ratingCard: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ratingLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  ratingMeta: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  ratingNotes: {
    color: colors.text,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    maxWidth: 300,
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryModalButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  primaryModalButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  recommendationIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  recommendationLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  recommendationPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recommendationRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  recommendationText: {
    flex: 1,
    gap: spacing.xs,
  },
  recommendationValue: {
    color: colors.text,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.base,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
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
  scannedDate: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  secondaryDraftButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  secondaryDraftButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  statusPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  statusPillText: {
    color: colors.text,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extraBold,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summary: {
    gap: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.base,
  },
  secondaryModalButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  secondaryModalButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.xl,
  },
  vintageLoading: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 220,
  },
  vintageLoadingText: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  vintagePickerContent: {
    paddingBottom: spacing.md,
  },
  vintageSheet: {
    height: '88%',
  },
  });
}

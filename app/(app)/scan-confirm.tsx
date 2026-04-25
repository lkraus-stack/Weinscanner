import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AromaPills } from '@/components/scan/AromaPills';
import { ConfidenceBadge } from '@/components/scan/ConfidenceBadge';
import {
  EditWineModal,
  type WineEditData,
} from '@/components/scan/EditWineModal';
import {
  VintageYearPicker,
  type VintageSuggestionKind,
} from '@/components/scan/VintageYearPicker';
import { WineDetailRow } from '@/components/scan/WineDetailRow';
import { saveScan, scanWineFromLabel } from '@/lib/ai-client';
import { useToastStore } from '@/stores/toast-store';
import { colors } from '@/theme/colors';
import { radii, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type {
  MinimalWineExtraction,
  SaveScanPayload,
  ScanWineResult,
  TasteDryness,
  VintageRecord,
  WineCorrection,
  WineColor,
  WineExtraction,
} from '@/types/wine-extraction';

type DisplayRow = {
  confidence?: number;
  label: string;
  value: string;
};

type AcceptedVintageSuggestion = {
  kind: VintageSuggestionKind;
  year: number;
} | null;

type VintageSuggestion = {
  kind: VintageSuggestionKind;
  reason: string | null;
  year: number;
} | null;

const LOADING_MESSAGES = [
  'KI analysiert dein Etikett...',
  'Wein wird identifiziert...',
  'Details werden gesammelt...',
] as const;

const WINE_COLORS = new Set<WineColor>([
  'weiss',
  'rot',
  'rose',
  'schaum',
  'suess',
]);
const TASTE_DRYNESS = new Set<TasteDryness>([
  'trocken',
  'halbtrocken',
  'lieblich',
  'suess',
]);

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function valueOrDash(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 'Nicht erkannt';
  }

  return String(value);
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function wineColorOrNull(value: unknown): WineColor | null {
  return typeof value === 'string' && WINE_COLORS.has(value as WineColor)
    ? (value as WineColor)
    : null;
}

function tasteDrynessOrNull(value: unknown): TasteDryness | null {
  return typeof value === 'string' && TASTE_DRYNESS.has(value as TasteDryness)
    ? (value as TasteDryness)
    : null;
}

function formatPercent(value: number | null) {
  return value === null ? 'Nicht erkannt' : `${value.toFixed(1)} %`;
}

function formatRange(start: number | null, end: number | null) {
  if (start && end) return `${start}-${end}`;
  if (start) return `ab ${start}`;
  if (end) return `bis ${end}`;
  return null;
}

function formatPrice(min: number | null, max: number | null) {
  if (min && max) return `${min.toFixed(0)}-${max.toFixed(0)} €`;
  if (min) return `ab ${min.toFixed(0)} €`;
  if (max) return `bis ${max.toFixed(0)} €`;
  return null;
}

function formatWineLabel(value: string | null) {
  if (!value) return 'Nicht erkannt';

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildTitle(extraction: WineExtraction) {
  const producer = extraction.producer || 'Unbekanntes Weingut';
  const wineName = extraction.wine_name || 'Weinname nicht erkannt';

  if (producer === wineName) {
    return producer;
  }

  return `${producer} • ${wineName}`;
}

function buildLabelRows(extraction: WineExtraction): DisplayRow[] {
  return [
    {
      confidence: extraction.confidence.producer,
      label: 'Weingut',
      value: valueOrDash(extraction.producer),
    },
    {
      confidence: extraction.confidence.wine_name,
      label: 'Wein',
      value: valueOrDash(extraction.wine_name),
    },
    { label: 'Region', value: valueOrDash(extraction.region) },
    { label: 'Land', value: valueOrDash(extraction.country) },
    { label: 'Appellation', value: valueOrDash(extraction.appellation) },
    { label: 'Rebsorte', value: valueOrDash(extraction.grape_variety) },
    { label: 'Farbe', value: formatWineLabel(extraction.wine_color) },
    { label: 'Geschmack', value: formatWineLabel(extraction.taste_dryness) },
    { label: 'Alkohol', value: formatPercent(extraction.alcohol_percent) },
  ];
}

function buildEnrichmentRows(extraction: WineExtraction): DisplayRow[] {
  const drinkingWindow = formatRange(
    extraction.drinking_window_start,
    extraction.drinking_window_end
  );
  const priceRange = formatPrice(
    extraction.price_min_eur,
    extraction.price_max_eur
  );

  return [
    { label: 'Trinkfenster', value: drinkingWindow ?? 'Nicht verfügbar' },
    { label: 'Preis', value: priceRange ?? 'Nicht verfügbar' },
    {
      label: 'Serviertemperatur',
      value: valueOrDash(extraction.serving_temperature),
    },
  ];
}

function hasEnrichment(extraction: WineExtraction) {
  return Boolean(
    extraction.aromas.length ||
      extraction.description_short ||
      extraction.description_long ||
      extraction.food_pairing ||
      extraction.serving_temperature ||
      extraction.vinification ||
      extraction.drinking_window_start ||
      extraction.drinking_window_end ||
      extraction.price_min_eur ||
      extraction.price_max_eur
  );
}

function needsBackLabelScan(
  extraction: WineExtraction,
  scanResult: ScanWineResult | null
) {
  const visibleVintageYear =
    scanResult?.minimal.vintage_year ??
    (scanResult?.source === 'fresh' ? extraction.vintage_year : null);
  const vintageConfidence =
    scanResult?.minimal.confidence.vintage_year ??
    extraction.confidence.vintage_year;

  return (
    visibleVintageYear === null ||
    vintageConfidence < 0.5
  );
}

function extractionToWineData(extraction: WineExtraction): WineEditData {
  return {
    alcohol_percent: extraction.alcohol_percent,
    appellation: extraction.appellation,
    country: extraction.country,
    grape_variety: extraction.grape_variety,
    producer: extraction.producer,
    region: extraction.region,
    taste_dryness: extraction.taste_dryness,
    wine_color: extraction.wine_color,
    wine_name: extraction.wine_name,
  };
}

function wineDataToExtraction(
  extraction: WineExtraction,
  wineData: WineEditData
): WineExtraction {
  return {
    ...extraction,
    alcohol_percent: wineData.alcohol_percent,
    appellation: wineData.appellation,
    country: wineData.country,
    grape_variety: wineData.grape_variety,
    producer: wineData.producer,
    region: wineData.region,
    taste_dryness: wineData.taste_dryness,
    wine_color: wineData.wine_color,
    wine_name: wineData.wine_name,
  };
}

function correctionValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function buildCorrections(
  original: WineExtraction | null,
  current: WineExtraction,
  acceptedVintageSuggestion: AcceptedVintageSuggestion
): WineCorrection[] {
  const vintageEstimateCorrection =
    acceptedVintageSuggestion?.kind === 'estimated'
      ? [
          {
            ai_value: `Geschätzt: ${acceptedVintageSuggestion.year}`,
            field: 'vintage_year_estimate',
            user_value: `Bestätigt: ${acceptedVintageSuggestion.year}`,
          },
        ]
      : [];

  if (!original) {
    return vintageEstimateCorrection;
  }

  const fields: (keyof WineEditData)[] = [
    'producer',
    'wine_name',
    'region',
    'country',
    'appellation',
    'grape_variety',
    'wine_color',
    'taste_dryness',
    'alcohol_percent',
  ];

  const fieldCorrections = fields
    .map((field) => ({
      ai_value: correctionValue(original[field]),
      field,
      user_value: correctionValue(current[field]),
    }))
    .filter((correction) => correction.ai_value !== correction.user_value);

  return [...fieldCorrections, ...vintageEstimateCorrection];
}

function emptyExtractionFromMinimal(
  minimal: MinimalWineExtraction,
  notes: string
): WineExtraction {
  return {
    alcohol_percent: null,
    appellation: null,
    aromas: [],
    confidence: minimal.confidence,
    country: null,
    data_sources: [],
    description_long: null,
    description_short: null,
    drinking_window_end: null,
    drinking_window_start: null,
    food_pairing: null,
    grape_variety: null,
    notes,
    price_max_eur: null,
    price_min_eur: null,
    estimated_vintage_year: minimal.estimated_vintage_year,
    estimated_vintage_year_reason: minimal.estimated_vintage_year_reason,
    producer: minimal.producer,
    region: null,
    serving_temperature: null,
    taste_dryness: null,
    vinification: null,
    vintage_year: minimal.vintage_year,
    wine_color: null,
    wine_name: minimal.wine_name,
  };
}

function vintageToExtraction(
  result: Extract<ScanWineResult, { source: 'cache' }>
): WineExtraction {
  const vintage: VintageRecord | null =
    result.matchedVintage ?? result.vintages[0] ?? null;

  return {
    alcohol_percent: numberOrNull(vintage?.alcohol_percent),
    appellation: result.wine.appellation,
    aromas: stringList(vintage?.aromas),
    confidence: result.minimal.confidence,
    country: result.wine.country,
    data_sources: stringList(vintage?.data_sources),
    description_long: vintage?.description_long ?? null,
    description_short: vintage?.description_short ?? null,
    drinking_window_end: vintage?.drinking_window_end ?? null,
    drinking_window_start: vintage?.drinking_window_start ?? null,
    food_pairing: vintage?.food_pairing ?? null,
    grape_variety: result.wine.grape_variety,
    notes: '',
    price_max_eur: numberOrNull(vintage?.price_max_eur),
    price_min_eur: numberOrNull(vintage?.price_min_eur),
    estimated_vintage_year: result.minimal.estimated_vintage_year,
    estimated_vintage_year_reason: result.minimal.estimated_vintage_year_reason,
    producer: result.wine.producer,
    region: result.wine.region,
    serving_temperature: vintage?.serving_temperature ?? null,
    taste_dryness: tasteDrynessOrNull(result.wine.taste_dryness),
    vinification: vintage?.vinification ?? null,
    vintage_year: vintage?.vintage_year ?? result.minimal.vintage_year,
    wine_color: wineColorOrNull(result.wine.wine_color),
    wine_name: result.wine.wine_name,
  };
}

function extractionFromScanResult(result: ScanWineResult): WineExtraction {
  if (result.source === 'fresh') {
    return result.extraction;
  }

  if (result.source === 'cache') {
    return vintageToExtraction(result);
  }

  return emptyExtractionFromMinimal(
    result.minimal,
    'Die Vorderseite war zu unsicher. Bitte scanne das Rücketikett oder gib die Daten später manuell ein.'
  );
}

function getSourceHint(result: ScanWineResult) {
  if (result.source === 'cache') {
    return {
      description: 'Anreicherung und Jahrgangsdaten kommen aus dem Cache.',
      icon: 'flash-outline' as const,
      title: 'Diesen Wein kennen wir schon',
    };
  }

  if (result.source === 'fresh') {
    return {
      description: 'Der Wein wurde neu analysiert und global vorgemerkt.',
      icon: 'sparkles-outline' as const,
      title: 'Wein wurde frisch analysiert',
    };
  }

  return {
    description: 'Für eine sichere Erkennung brauchen wir eine zweite Ansicht.',
    icon: 'scan-circle-outline' as const,
    title: 'Weitere Infos nötig',
  };
}

function getKnownYears(result: ScanWineResult | null) {
  if (!result || result.source !== 'cache') {
    return [];
  }

  return result.vintages
    .map((vintage) => vintage.vintage_year)
    .filter((year): year is number => typeof year === 'number');
}

function getVintageSuggestion(result: ScanWineResult | null): VintageSuggestion {
  if (!result) {
    return null;
  }

  if (typeof result.minimal.vintage_year === 'number') {
    return {
      kind: 'recognized',
      reason: null,
      year: result.minimal.vintage_year,
    };
  }

  const freshEstimate =
    result.source === 'fresh' ? result.extraction.estimated_vintage_year : null;
  const freshReason =
    result.source === 'fresh'
      ? result.extraction.estimated_vintage_year_reason
      : null;
  const estimatedYear =
    result.minimal.estimated_vintage_year ?? freshEstimate ?? null;

  if (typeof estimatedYear !== 'number') {
    return null;
  }

  return {
    kind: 'estimated',
    reason: result.minimal.estimated_vintage_year_reason ?? freshReason,
    year: estimatedYear,
  };
}

function getWineId(result: ScanWineResult | null) {
  if (!result || result.source === 'low_confidence') {
    return null;
  }

  return result.wine.id;
}

function getAnalysisVintageId(result: ScanWineResult | null) {
  if (!result || result.source === 'low_confidence') {
    return null;
  }

  return result.matchedVintage?.id ?? null;
}

function getSaveSource(result: ScanWineResult | null): SaveScanPayload['source'] {
  if (!result || result.source === 'low_confidence') {
    return 'manual';
  }

  return result.source;
}

function buildSavePayload({
  corrections,
  extraction,
  imageUrl,
  scanResult,
  selectedVintageYear,
  storagePath,
}: {
  corrections: WineCorrection[];
  extraction: WineExtraction;
  imageUrl: string;
  scanResult: ScanWineResult | null;
  selectedVintageYear: number;
  storagePath: string;
}): SaveScanPayload {
  return {
    analysisVintageId: getAnalysisVintageId(scanResult),
    bottleStoragePath: null,
    corrections,
    imageUrl,
    selectedVintageYear,
    source: getSaveSource(scanResult),
    storagePath,
    vintageData: {
      ai_confidence: extraction.confidence.overall,
      alcohol_percent: extraction.alcohol_percent,
      aromas: extraction.aromas,
      data_sources: extraction.data_sources,
      description_long: extraction.description_long,
      description_short: extraction.description_short,
      drinking_window_end: extraction.drinking_window_end,
      drinking_window_start: extraction.drinking_window_start,
      food_pairing: extraction.food_pairing,
      price_max_eur: extraction.price_max_eur,
      price_min_eur: extraction.price_min_eur,
      serving_temperature: extraction.serving_temperature,
      vinification: extraction.vinification,
    },
    wineData: extractionToWineData(extraction),
    wineId: getWineId(scanResult),
  };
}

export default function ScanConfirmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((state) => state.showToast);
  const params = useLocalSearchParams<{
    signedUrl?: string;
    storagePath?: string;
  }>();
  const signedUrl = normalizeParam(params.signedUrl);
  const storagePath = normalizeParam(params.storagePath);
  const [extraction, setExtraction] = useState<WineExtraction | null>(null);
  const [originalExtraction, setOriginalExtraction] =
    useState<WineExtraction | null>(null);
  const [scanResult, setScanResult] = useState<ScanWineResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedVintageYear, setSelectedVintageYear] = useState<number | null>(
    null
  );
  const [acceptedVintageSuggestion, setAcceptedVintageSuggestion] =
    useState<AcceptedVintageSuggestion>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const interval = setInterval(() => {
      setLoadingIndex((currentIndex) =>
        (currentIndex + 1) % LOADING_MESSAGES.length
      );
    }, 1800);

    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    let isMounted = true;

    async function runAnalysis() {
      if (!signedUrl) {
        setErrorMessage('Bild-URL fehlt. Bitte versuche den Scan erneut.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);
        setExtraction(null);
        setOriginalExtraction(null);
        setScanResult(null);
        setSelectedVintageYear(null);
        setAcceptedVintageSuggestion(null);

        const result = await scanWineFromLabel(signedUrl);

        if (!isMounted) return;

        const normalizedExtraction = extractionFromScanResult(result);

        setScanResult(result);
        setOriginalExtraction(normalizedExtraction);
        setExtraction(normalizedExtraction);
      } catch (error: unknown) {
        if (!isMounted) return;

        console.error('Etikett-Analyse fehlgeschlagen:', error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Etikett konnte nicht analysiert werden.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void runAnalysis();

    return () => {
      isMounted = false;
    };
  }, [retryToken, signedUrl]);

  const labelRows = useMemo(
    () => (extraction ? buildLabelRows(extraction) : []),
    [extraction]
  );
  const enrichmentRows = useMemo(
    () => (extraction ? buildEnrichmentRows(extraction) : []),
    [extraction]
  );
  const knownYears = useMemo(() => getKnownYears(scanResult), [scanResult]);
  const vintageSuggestion = useMemo(
    () => getVintageSuggestion(scanResult),
    [scanResult]
  );
  const corrections = useMemo(
    () =>
      extraction
        ? buildCorrections(
            originalExtraction,
            extraction,
            acceptedVintageSuggestion
          )
        : [],
    [acceptedVintageSuggestion, extraction, originalExtraction]
  );
  const canSave = Boolean(
    selectedVintageYear !== null &&
      extraction?.producer.trim() &&
      extraction?.wine_name.trim() &&
      storagePath &&
      signedUrl &&
      !isSaving
  );

  function goToHistory() {
    router.replace('/(app)');
  }

  function discardScan() {
    router.replace('/(app)/scan');
  }

  function retryAnalysis() {
    setRetryToken((currentToken) => currentToken + 1);
  }

  function openEditModal() {
    setIsEditModalVisible(true);
  }

  function saveEditedWine(wineData: WineEditData) {
    setExtraction((currentExtraction) =>
      currentExtraction
        ? wineDataToExtraction(currentExtraction, wineData)
        : currentExtraction
    );
    setIsEditModalVisible(false);
  }

  function changeVintageYear(vintageYear: number | null) {
    setSelectedVintageYear(vintageYear);
    setAcceptedVintageSuggestion(null);
  }

  function acceptVintageSuggestion(
    vintageYear: number,
    kind: VintageSuggestionKind
  ) {
    setSelectedVintageYear(vintageYear);
    setAcceptedVintageSuggestion({ kind, year: vintageYear });
  }

  async function saveConfirmedScan() {
    if (!extraction || !signedUrl || !storagePath || selectedVintageYear === null) {
      return;
    }

    try {
      setIsSaving(true);
      await saveScan(
        buildSavePayload({
          corrections,
          extraction,
          imageUrl: signedUrl,
          scanResult,
          selectedVintageYear,
          storagePath,
        })
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Wein gespeichert');
      router.replace('/(app)');
    } catch (error: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        error instanceof Error
          ? error.message
          : 'Wein konnte nicht gespeichert werden.';

      Alert.alert('Speichern fehlgeschlagen', message, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Erneut versuchen', onPress: saveConfirmedScan },
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  function scanBackLabel() {
    router.replace({
      pathname: '/(app)/scan',
      params: {
        scanTarget: 'back-label',
      },
    });
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityLabel="Scan verwerfen"
          onPress={goToHistory}
          style={styles.headerButton}
        >
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Erkennung prüfen</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxxl },
        ]}
      >
        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.centerTitle}>
              {LOADING_MESSAGES[loadingIndex]}
            </Text>
            <Text style={styles.centerDescription}>
              Das dauert normalerweise ein paar Sekunden.
            </Text>
          </View>
        ) : null}

        {!isLoading && errorMessage ? (
          <View style={styles.centerState}>
            <Ionicons name="warning-outline" size={42} color={colors.error} />
            <Text style={styles.centerTitle}>Analyse fehlgeschlagen</Text>
            <Text style={styles.centerDescription}>{errorMessage}</Text>
            <View style={styles.errorActions}>
              <Pressable onPress={goToHistory} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Abbrechen</Text>
              </Pressable>
              <Pressable onPress={retryAnalysis} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Erneut versuchen</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isLoading && extraction ? (
          <>
            {signedUrl ? (
              <Image
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: signedUrl }}
                style={styles.thumbnail}
              />
            ) : null}

            <View style={styles.summary}>
              <Text style={styles.eyebrow}>Erkannter Wein</Text>
              <Text style={styles.title}>{buildTitle(extraction)}</Text>
              <View style={styles.summaryActions}>
                <ConfidenceBadge score={extraction.confidence.overall} />
                <Pressable onPress={openEditModal} style={styles.editButton}>
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.editButtonText}>Bearbeiten</Text>
                </Pressable>
              </View>
            </View>

            {scanResult ? <SourceHint result={scanResult} /> : null}

            <Section title="Jahrgang">
              <VintageYearPicker
                knownYears={knownYears}
                onAcceptSuggestion={acceptVintageSuggestion}
                onChange={changeVintageYear}
                suggestionKind={vintageSuggestion?.kind}
                suggestionReason={vintageSuggestion?.reason}
                suggestedYear={vintageSuggestion?.year ?? null}
                value={selectedVintageYear}
              />
            </Section>

            {needsBackLabelScan(extraction, scanResult) ? (
              <View style={styles.vintageWarningCard}>
                <View style={styles.vintageWarningHeader}>
                  <Ionicons
                    name="scan-circle-outline"
                    size={24}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.vintageWarningTitle}>Jahrgang fehlt</Text>
                </View>
                <Text style={styles.vintageWarningText}>
                  Auf dem vorderen Etikett ist kein Jahrgang sicher sichtbar.
                  Du kannst eine Schätzung bestätigen, manuell ein Jahr wählen
                  oder das Rücketikett für mehr Sicherheit scannen.
                </Text>
                <Pressable
                  onPress={scanBackLabel}
                  style={styles.vintageWarningButton}
                >
                  <Ionicons
                    name="camera-outline"
                    size={20}
                    color={colors.white}
                  />
                  <Text style={styles.vintageWarningButtonText}>
                    Rücketikett scannen
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Section title="Etikett-Daten">
              <View style={styles.list}>
                {labelRows.map((row) => (
                  <WineDetailRow
                    confidence={row.confidence}
                    key={row.label}
                    label={row.label}
                    value={row.value}
                  />
                ))}
              </View>
            </Section>

            {hasEnrichment(extraction) ? (
              <Section title="Anreicherung">
                <View style={styles.list}>
                  {enrichmentRows.map((row) => (
                    <WineDetailRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                    />
                  ))}
                </View>

                <AromaPills aromas={extraction.aromas} />

                {extraction.description_short ? (
                  <TextBlock
                    label="Kurzbeschreibung"
                    text={extraction.description_short}
                  />
                ) : null}

                {extraction.description_long ? (
                  <TextBlock
                    label="Beschreibung"
                    text={extraction.description_long}
                  />
                ) : null}

                {extraction.food_pairing ? (
                  <TextBlock label="Food Pairing" text={extraction.food_pairing} />
                ) : null}

                {extraction.vinification ? (
                  <TextBlock label="Vinifikation" text={extraction.vinification} />
                ) : null}
              </Section>
            ) : null}

            {extraction.data_sources.length > 0 ? (
              <Section title="Quellen">
                <View style={styles.sourceList}>
                  {extraction.data_sources.map((source, index) => (
                    <Pressable
                      key={source}
                      onPress={() => void Linking.openURL(source)}
                      style={styles.sourceRow}
                    >
                      <Ionicons
                        name="link-outline"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.sourceText}>Quelle {index + 1}</Text>
                    </Pressable>
                  ))}
                </View>
              </Section>
            ) : null}

            {extraction.notes ? (
              <TextBlock label="Hinweis" text={extraction.notes} />
            ) : null}

            <View style={styles.actions}>
              <Pressable onPress={discardScan} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Verwerfen</Text>
              </Pressable>
              <Pressable
                disabled={!canSave}
                onPress={saveConfirmedScan}
                style={[styles.primaryButton, !canSave && styles.disabledButton]}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Wein speichern</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      {extraction ? (
        <EditWineModal
          onClose={() => setIsEditModalVisible(false)}
          onSave={saveEditedWine}
          value={extractionToWineData(extraction)}
          visible={isEditModalVisible}
        />
      ) : null}
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
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SourceHint({ result }: { result: ScanWineResult }) {
  const hint = getSourceHint(result);

  return (
    <View style={styles.sourceHint}>
      <Ionicons name={hint.icon} size={22} color={colors.primaryDark} />
      <View style={styles.sourceHintText}>
        <Text style={styles.sourceHintTitle}>{hint.title}</Text>
        <Text style={styles.sourceHintDescription}>{hint.description}</Text>
      </View>
    </View>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.textBlock}>
      <Text style={styles.textBlockLabel}>{label}</Text>
      <Text style={styles.textBlockText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  centerDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 420,
  },
  centerTitle: {
    color: colors.text,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.black,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    padding: spacing.screenX,
  },
  disabledButton: {
    opacity: 0.45,
  },
  editButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  editButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
  },
  errorActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },
  eyebrow: {
    color: colors.primaryDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
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
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  section: {
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
  },
  sourceList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sourceHint: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  sourceHintDescription: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    marginTop: spacing.xs,
  },
  sourceHintText: {
    flex: 1,
  },
  sourceHintTitle: {
    color: colors.primaryDark,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  sourceRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sourceText: {
    color: colors.primaryDark,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  summary: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  summaryActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  textBlock: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  textBlockLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  textBlockText: {
    color: colors.text,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    marginTop: spacing.sm,
  },
  thumbnail: {
    alignSelf: 'center',
    aspectRatio: 4 / 5,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    width: 132,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    lineHeight: typography.lineHeight.xl,
  },
  vintageWarningButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  vintageWarningButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.extraBold,
  },
  vintageWarningCard: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.primary,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  vintageWarningHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  vintageWarningText: {
    color: colors.text,
    fontSize: typography.size.base,
    lineHeight: typography.lineHeight.base,
    marginTop: spacing.sm,
  },
  vintageWarningTitle: {
    color: colors.primaryDark,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
  },
});

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { supabase } from '@/lib/supabase';

type ExportFormat = 'csv' | 'json';

type ExportUserDataParams = {
  format: ExportFormat;
};

type ExportData = {
  ai_feedback: unknown[];
  exported_at: string;
  inventory_items: unknown[];
  profile: unknown;
  ratings: unknown[];
  scans: unknown[];
};

const CSV_BLOCKS: { key: keyof ExportData; title: string }[] = [
  { key: 'profile', title: 'profile' },
  { key: 'scans', title: 'scans' },
  { key: 'ratings', title: 'ratings' },
  { key: 'inventory_items', title: 'inventory_items' },
  { key: 'ai_feedback', title: 'ai_feedback' },
];

function todayStamp() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map((row) =>
      row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    );
  }

  if (value && typeof value === 'object') {
    return [value as Record<string, unknown>];
  }

  return [];
}

function flattenValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function csvCell(value: unknown) {
  const text = flattenValue(value);
  const escapedText = text.replace(/"/g, '""');

  return `"${escapedText}"`;
}

function rowsToCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return 'Keine Daten';
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ];

  return lines.join('\n');
}

function dataToCsv(data: ExportData) {
  return CSV_BLOCKS.map(({ key, title }) => {
    const value = data[key];

    return [`# ${title}`, rowsToCsv(normalizeRows(value))].join('\n');
  }).join('\n\n');
}

async function getExportData(): Promise<ExportData> {
  const [
    profileResult,
    scansResult,
    ratingsResult,
    inventoryResult,
    feedbackResult,
  ] = await Promise.all([
    supabase.from('profiles').select().single(),
    supabase
      .from('scans')
      .select(
        `
          id,
          scanned_at,
          label_image_url,
          bottle_image_url,
          scan_location_name,
          vintage:vintages (
            id,
            vintage_year,
            wine:wines (
              id,
              producer,
              wine_name,
              region,
              country,
              grape_variety,
              wine_color
            )
          )
        `
      )
      .order('scanned_at', { ascending: false }),
    supabase
      .from('ratings')
      .select(
        `
          id,
          stars,
          notes,
          drank_at,
          occasion,
          created_at,
          scan_id,
          vintage:vintages (
            id,
            vintage_year,
            wine:wines (
              id,
              producer,
              wine_name,
              region,
              country,
              grape_variety,
              wine_color
            )
          )
        `
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('inventory_items')
      .select(
        `
          id,
          quantity,
          storage_location,
          purchased_at,
          purchase_price,
          notes,
          created_at,
          vintage:vintages (
            id,
            vintage_year,
            wine:wines (
              id,
              producer,
              wine_name,
              region,
              country,
              grape_variety,
              wine_color
            )
          )
        `
      )
      .order('created_at', { ascending: false }),
    supabase.from('ai_feedback').select().order('created_at', {
      ascending: false,
    }),
  ]);

  const error =
    profileResult.error ??
    scansResult.error ??
    ratingsResult.error ??
    inventoryResult.error ??
    feedbackResult.error;

  if (error) {
    throw new Error(error.message || 'Export konnte nicht erstellt werden.');
  }

  return {
    ai_feedback: feedbackResult.data ?? [],
    exported_at: new Date().toISOString(),
    inventory_items: inventoryResult.data ?? [],
    profile: profileResult.data,
    ratings: ratingsResult.data ?? [],
    scans: scansResult.data ?? [],
  };
}

export async function exportUserData({ format }: ExportUserDataParams) {
  const data = await getExportData();
  const fileName = `wine-scanner-export-${todayStamp()}.${format}`;
  const uri = `${FileSystem.documentDirectory}${fileName}`;
  const content =
    format === 'json' ? JSON.stringify(data, null, 2) : dataToCsv(data);

  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: format === 'json' ? 'application/json' : 'text/csv',
    UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
  });

  return { uri };
}

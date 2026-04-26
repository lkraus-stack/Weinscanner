import {
  type InfiniteData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { batchSignedUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type WineColor = 'weiss' | 'rot' | 'rose' | 'schaum' | 'suess';

export type HistoryFilters = {
  searchQuery?: string;
  wineColor?: WineColor;
};

export type HistoryItemRecord = {
  country: string | null;
  grapeVariety: string | null;
  labelImagePath: string | null;
  labelImageUrl: string | null;
  producer: string;
  ratingId: string | null;
  ratingStars: number | null;
  region: string | null;
  scannedAt: string;
  scanId: string;
  vintageId: string;
  vintageYear: number;
  wineColor: WineColor | null;
  wineId: string;
  wineName: string;
};

type HistoryRpcRow = {
  country: string | null;
  grape_variety: string | null;
  label_image_path: string | null;
  producer: string;
  rating_id: string | null;
  rating_stars: number | null;
  region: string | null;
  scanned_at: string;
  scan_id: string;
  vintage_id: string;
  vintage_year: number;
  wine_color: string | null;
  wine_id: string;
  wine_name: string;
};

const HISTORY_PAGE_SIZE = 20;

type HistoryPage = {
  data: HistoryItemRecord[];
  nextPage?: number;
};

function normalizeSearchQuery(value?: string) {
  const trimmed = value?.trim() ?? '';

  return trimmed.length > 1 ? trimmed : undefined;
}

function isWineColor(value: string | null): WineColor | null {
  if (
    value === 'weiss' ||
    value === 'rot' ||
    value === 'rose' ||
    value === 'schaum' ||
    value === 'suess'
  ) {
    return value;
  }

  return null;
}

async function createSignedUrlMap(rows: HistoryRpcRow[]) {
  const paths = rows
    .map((row) => row.label_image_path)
    .filter((path): path is string => Boolean(path));

  return batchSignedUrls(paths);
}

function mapHistoryRow(
  row: HistoryRpcRow,
  signedUrlMap: Record<string, string>
): HistoryItemRecord {
  return {
    country: row.country,
    grapeVariety: row.grape_variety,
    labelImagePath: row.label_image_path,
    labelImageUrl: row.label_image_path
      ? (signedUrlMap[row.label_image_path] ?? null)
      : null,
    producer: row.producer,
    ratingId: row.rating_id,
    ratingStars: row.rating_stars,
    region: row.region,
    scannedAt: row.scanned_at,
    scanId: row.scan_id,
    vintageId: row.vintage_id,
    vintageYear: row.vintage_year,
    wineColor: isWineColor(row.wine_color),
    wineId: row.wine_id,
    wineName: row.wine_name,
  };
}

export function useHistory(filters: HistoryFilters) {
  const searchQuery = normalizeSearchQuery(filters.searchQuery);
  const wineColor = filters.wineColor;

  return useInfiniteQuery<
    HistoryPage,
    Error,
    InfiniteData<HistoryPage>,
    [string, { searchQuery?: string; wineColor?: WineColor }],
    number
  >({
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('get_user_scan_history', {
        page_limit: HISTORY_PAGE_SIZE,
        page_offset: pageParam,
        search_query: searchQuery,
        wine_color_filter: wineColor,
      });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as HistoryRpcRow[];
      const signedUrlMap = await createSignedUrlMap(rows);

      return {
        data: rows.map((row) => mapHistoryRow(row, signedUrlMap)),
        nextPage:
          rows.length === HISTORY_PAGE_SIZE
            ? pageParam + HISTORY_PAGE_SIZE
            : undefined,
      };
    },
    queryKey: ['history', { searchQuery, wineColor }],
    staleTime: 30_000,
  });
}

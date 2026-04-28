import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import type { Tables } from '@/types/database';

type WineRow = Pick<
  Tables<'wines'>,
  | 'appellation'
  | 'country'
  | 'grape_variety'
  | 'id'
  | 'producer'
  | 'region'
  | 'sub_region'
  | 'taste_dryness'
  | 'wine_color'
  | 'wine_name'
>;

type VintageRow = Pick<
  Tables<'vintages'>,
  | 'alcohol_percent'
  | 'aromas'
  | 'description_long'
  | 'description_short'
  | 'drinking_window_end'
  | 'drinking_window_start'
  | 'food_pairing'
  | 'id'
  | 'price_max_eur'
  | 'price_min_eur'
  | 'serving_temperature'
  | 'vinification'
  | 'vintage_year'
  | 'wine_id'
>;

type RatingRow = Pick<
  Tables<'ratings'>,
  'created_at' | 'drank_at' | 'id' | 'notes' | 'occasion' | 'stars'
>;

type RawScanDetail = {
  bottle_image_url: string | null;
  id: string;
  label_image_url: string | null;
  ratings: RatingRow[] | null;
  scan_location_name: string | null;
  scanned_at: string;
  vintage:
    | (VintageRow & {
        wine: WineRow | null;
      })
    | null;
};

export type ScanDetailWine = WineRow;

export type ScanDetailVintage = Omit<VintageRow, 'aromas'> & {
  aromas: string[];
  wine: ScanDetailWine | null;
};

export type ScanDetailRating = RatingRow;

export type ScanDetail = {
  bottleImagePath: string | null;
  bottleImageUrl: string | null;
  id: string;
  labelImagePath: string | null;
  labelImageUrl: string | null;
  ratings: ScanDetailRating[];
  scanLocationName: string | null;
  scannedAt: string;
  vintage: ScanDetailVintage | null;
};

function normalizeScanId(scanId?: string) {
  const normalizedScanId = scanId?.trim();

  return normalizedScanId ? normalizedScanId : undefined;
}

function isRemoteUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function sortRatings(ratings: RatingRow[] | null) {
  return [...(ratings ?? [])].sort(
    (firstRating, secondRating) =>
      new Date(secondRating.created_at).getTime() -
      new Date(firstRating.created_at).getTime()
  );
}

async function createSignedUrlMap(paths: (string | null)[]) {
  const uniquePaths = [
    ...new Set(paths.filter((path): path is string => Boolean(path))),
  ];
  const signedUrlMap = new Map<string, string>();
  const storagePaths = uniquePaths.filter((path) => !isRemoteUrl(path));

  for (const remoteUrl of uniquePaths.filter(isRemoteUrl)) {
    signedUrlMap.set(remoteUrl, remoteUrl);
  }

  if (storagePaths.length === 0) {
    return signedUrlMap;
  }

  const { data, error } = await supabase.storage
    .from('wine-labels')
    .createSignedUrls(storagePaths, 3600);

  if (error || !data) {
    return signedUrlMap;
  }

  for (const item of data) {
    if (item.path && item.signedUrl) {
      signedUrlMap.set(item.path, item.signedUrl);
    }
  }

  return signedUrlMap;
}

function mapScanDetail(
  rawScanDetail: RawScanDetail,
  signedUrlMap: Map<string, string>
): ScanDetail {
  return {
    bottleImagePath: rawScanDetail.bottle_image_url,
    bottleImageUrl: rawScanDetail.bottle_image_url
      ? (signedUrlMap.get(rawScanDetail.bottle_image_url) ?? null)
      : null,
    id: rawScanDetail.id,
    labelImagePath: rawScanDetail.label_image_url,
    labelImageUrl: rawScanDetail.label_image_url
      ? (signedUrlMap.get(rawScanDetail.label_image_url) ?? null)
      : null,
    ratings: sortRatings(rawScanDetail.ratings),
    scanLocationName: rawScanDetail.scan_location_name,
    scannedAt: rawScanDetail.scanned_at,
    vintage: rawScanDetail.vintage
      ? {
          ...rawScanDetail.vintage,
          aromas: stringList(rawScanDetail.vintage.aromas),
        }
      : null,
  };
}

async function fetchScanDetail(scanId: string): Promise<ScanDetail> {
  const { data, error } = await supabase
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
          drinking_window_start,
          drinking_window_end,
          price_min_eur,
          price_max_eur,
          alcohol_percent,
          aromas,
          description_short,
          description_long,
          food_pairing,
          serving_temperature,
          vinification,
          wine_id,
          wine:wines (
            id,
            producer,
            wine_name,
            region,
            sub_region,
            country,
            appellation,
            grape_variety,
            wine_color,
            taste_dryness
          )
        ),
        ratings (
          id,
          stars,
          notes,
          drank_at,
          occasion,
          created_at
        )
      `
    )
    .eq('id', scanId)
    .single();

  if (error) {
    throw error;
  }

  const rawScanDetail = data as RawScanDetail;
  const signedUrlMap = await createSignedUrlMap([
    rawScanDetail.label_image_url,
    rawScanDetail.bottle_image_url,
  ]);

  return mapScanDetail(rawScanDetail, signedUrlMap);
}

export function useScanDetail(scanId?: string) {
  const user = useAuthStore((state) => state.user);
  const normalizedScanId = normalizeScanId(scanId);

  return useQuery<ScanDetail, Error>({
    enabled: Boolean(normalizedScanId && user?.id),
    queryFn: () => {
      if (!normalizedScanId) {
        throw new Error('Scan-ID fehlt.');
      }

      if (!user?.id) {
        throw new Error('Nicht eingeloggt.');
      }

      return fetchScanDetail(normalizedScanId);
    },
    queryKey: ['scan-detail', normalizedScanId, user?.id],
    staleTime: 60_000,
  });
}

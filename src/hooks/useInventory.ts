import {
  type InfiniteData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { batchSignedUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type InventoryFilters = {
  hideEmptyInventory?: boolean;
  storageLocation?: string;
};

type InventoryWine = Pick<
  Tables<'wines'>,
  'country' | 'id' | 'producer' | 'region' | 'wine_color' | 'wine_name'
>;

type InventoryVintage = Pick<Tables<'vintages'>, 'id' | 'vintage_year'> & {
  wine: InventoryWine | null;
};

export type InventoryListItem = Pick<
  Tables<'inventory_items'>,
  | 'created_at'
  | 'id'
  | 'notes'
  | 'purchase_price'
  | 'purchased_at'
  | 'quantity'
  | 'storage_location'
  | 'vintage_id'
> & {
  imagePath: string | null;
  imageUrl: string | null;
  latestScanId: string | null;
  vintage: InventoryVintage | null;
};

type RawInventoryListItem = Pick<
  Tables<'inventory_items'>,
  | 'created_at'
  | 'id'
  | 'notes'
  | 'purchase_price'
  | 'purchased_at'
  | 'quantity'
  | 'storage_location'
  | 'vintage_id'
> & {
  vintage: InventoryVintage | null;
};

type ScanPhotoRow = Pick<
  Tables<'scans'>,
  'id' | 'label_image_url' | 'scanned_at' | 'vintage_id'
>;

type InventoryPage = {
  data: InventoryListItem[];
  nextPage?: number;
};

const INVENTORY_PAGE_SIZE = 20;

async function createLatestScanMap(rows: RawInventoryListItem[]) {
  const vintageIds = [
    ...new Set(rows.map((row) => row.vintage_id).filter(Boolean)),
  ];

  if (vintageIds.length === 0) {
    return new Map<string, ScanPhotoRow>();
  }

  const { data, error } = await supabase
    .from('scans')
    .select('id, vintage_id, label_image_url, scanned_at')
    .in('vintage_id', vintageIds)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return new Map<string, ScanPhotoRow>();
  }

  const scanMap = new Map<string, ScanPhotoRow>();

  for (const scan of data as ScanPhotoRow[]) {
    if (scan.vintage_id && !scanMap.has(scan.vintage_id)) {
      scanMap.set(scan.vintage_id, scan);
    }
  }

  return scanMap;
}

async function mapInventoryRows(
  rows: RawInventoryListItem[]
): Promise<InventoryListItem[]> {
  const scanMap = await createLatestScanMap(rows);
  const imagePaths = [...scanMap.values()]
    .map((scan) => scan.label_image_url)
    .filter((path): path is string => Boolean(path));
  const signedUrlMap = await batchSignedUrls(imagePaths);

  return rows.map((row) => {
    const scan = scanMap.get(row.vintage_id);
    const imagePath = scan?.label_image_url ?? null;

    return {
      ...row,
      imagePath,
      imageUrl: imagePath ? (signedUrlMap[imagePath] ?? null) : null,
      latestScanId: scan?.id ?? null,
    };
  });
}

export function useInventory(filters: InventoryFilters) {
  const hideEmptyInventory = filters.hideEmptyInventory ?? false;
  const storageLocation = filters.storageLocation?.trim() || undefined;

  return useInfiniteQuery<
    InventoryPage,
    Error,
    InfiniteData<InventoryPage>,
    [string, { hideEmptyInventory: boolean; storageLocation?: string }],
    number
  >({
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam * INVENTORY_PAGE_SIZE;
      const to = from + INVENTORY_PAGE_SIZE - 1;
      let query = supabase
        .from('inventory_items')
        .select(
          `
            id,
            vintage_id,
            quantity,
            storage_location,
            purchased_at,
            purchase_price,
            notes,
            created_at,
            vintage:vintages!inner (
              id,
              vintage_year,
              wine:wines!inner (
                id,
                producer,
                wine_name,
                region,
                country,
                wine_color
              )
            )
          `
        )
        .order('created_at', { ascending: false })
        .range(from, to);

      if (storageLocation) {
        query = query.eq('storage_location', storageLocation);
      }

      if (hideEmptyInventory) {
        query = query.gt('quantity', 0);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as RawInventoryListItem[];

      return {
        data: await mapInventoryRows(rows),
        nextPage:
          rows.length === INVENTORY_PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    queryKey: ['inventory', { hideEmptyInventory, storageLocation }],
    staleTime: 30_000,
  });
}

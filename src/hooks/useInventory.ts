import {
  type InfiniteData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { batchSignedUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type InventoryFilters = {
  hideEmptyInventory?: boolean;
  storageLocation?: string;
};

type InventoryWine = {
  country: string | null;
  id: string;
  producer: string;
  region: string | null;
  wine_color: string | null;
  wine_name: string;
};

type InventoryVintage = {
  id: string;
  vintage_year: number;
  wine: InventoryWine | null;
};

export type InventoryListItem = {
  created_at: string;
  imagePath: string | null;
  imageUrl: string | null;
  id: string;
  latestScanId: string | null;
  notes: string | null;
  purchase_price: number | null;
  purchased_at: string | null;
  quantity: number | null;
  storage_location: string | null;
  vintage_id: string;
  vintage: InventoryVintage | null;
};

type InventoryRpcRow = {
  country: string | null;
  created_at: string;
  id: string;
  image_path: string | null;
  latest_scan_id: string | null;
  notes: string | null;
  producer: string;
  purchase_price: number | null;
  purchased_at: string | null;
  quantity: number | null;
  region: string | null;
  storage_location: string | null;
  vintage_id: string;
  vintage_year: number;
  wine_color: string | null;
  wine_id: string;
  wine_name: string;
};

type InventoryPage = {
  data: InventoryListItem[];
  nextPage?: number;
};

const INVENTORY_PAGE_SIZE = 20;

async function mapInventoryRows(
  rows: InventoryRpcRow[]
): Promise<InventoryListItem[]> {
  const imagePaths = rows
    .map((row) => row.image_path)
    .filter((path): path is string => Boolean(path));
  const signedUrlMap = await batchSignedUrls(imagePaths);

  return rows.map((row) => {
    const imagePath = row.image_path;

    return {
      created_at: row.created_at,
      id: row.id,
      imagePath,
      imageUrl: imagePath ? (signedUrlMap[imagePath] ?? null) : null,
      latestScanId: row.latest_scan_id,
      notes: row.notes,
      purchase_price: row.purchase_price,
      purchased_at: row.purchased_at,
      quantity: row.quantity,
      storage_location: row.storage_location,
      vintage: {
        id: row.vintage_id,
        vintage_year: row.vintage_year,
        wine: {
          country: row.country,
          id: row.wine_id,
          producer: row.producer,
          region: row.region,
          wine_color: row.wine_color,
          wine_name: row.wine_name,
        },
      },
      vintage_id: row.vintage_id,
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
      const { data, error } = await supabase.rpc(
        'get_user_inventory_with_photos',
        {
          hide_empty_inventory: hideEmptyInventory,
          page_limit: INVENTORY_PAGE_SIZE,
          page_offset: pageParam * INVENTORY_PAGE_SIZE,
          storage_location_filter: storageLocation,
        }
      );

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as InventoryRpcRow[];

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

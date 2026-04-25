import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

type InventoryStatsRow = Pick<
  Tables<'inventory_items'>,
  'id' | 'purchase_price' | 'quantity' | 'storage_location' | 'vintage_id'
>;

export type InventoryStats = {
  emptyItems: number;
  estimatedValue: number;
  storageLocations: string[];
  totalBottles: number;
  vintageCount: number;
};

function mapInventoryStats(rows: InventoryStatsRow[]): InventoryStats {
  const storageLocations = new Set<string>();
  const vintagesInStock = new Set<string>();
  let emptyItems = 0;
  let estimatedValue = 0;
  let totalBottles = 0;

  for (const row of rows) {
    const quantity = row.quantity ?? 0;

    totalBottles += quantity;

    if (quantity === 0) {
      emptyItems += 1;
    }

    if (quantity > 0) {
      vintagesInStock.add(row.vintage_id);
    }

    if (row.storage_location?.trim()) {
      storageLocations.add(row.storage_location.trim());
    }

    if (typeof row.purchase_price === 'number' && quantity > 0) {
      estimatedValue += quantity * row.purchase_price;
    }
  }

  return {
    emptyItems,
    estimatedValue,
    storageLocations: [...storageLocations].sort((first, second) =>
      first.localeCompare(second, 'de-DE')
    ),
    totalBottles,
    vintageCount: vintagesInStock.size,
  };
}

export function useInventoryStats() {
  return useQuery<InventoryStats, Error>({
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, vintage_id, quantity, storage_location, purchase_price');

      if (error) {
        throw error;
      }

      return mapInventoryStats((data ?? []) as InventoryStatsRow[]);
    },
    queryKey: ['inventory-stats'],
    staleTime: 30_000,
  });
}

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type WineVintageOption = Pick<Tables<'vintages'>, 'id' | 'vintage_year'>;

function normalizeWineId(wineId?: string | null) {
  const normalizedWineId = wineId?.trim();

  return normalizedWineId ? normalizedWineId : undefined;
}

export function useWineVintages(wineId?: string | null) {
  const normalizedWineId = normalizeWineId(wineId);

  return useQuery<WineVintageOption[], Error>({
    enabled: Boolean(normalizedWineId),
    queryFn: async () => {
      if (!normalizedWineId) {
        return [];
      }

      const { data, error } = await supabase
        .from('vintages')
        .select('id, vintage_year')
        .eq('wine_id', normalizedWineId)
        .order('vintage_year', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as WineVintageOption[];
    },
    queryKey: ['wine-vintages', normalizedWineId],
    staleTime: 60_000,
  });
}

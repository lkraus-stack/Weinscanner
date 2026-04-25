import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

export type UserStats = {
  distinctRegions: number;
  ratingCount: number;
  scanCount: number;
  topGrapeVariety: string | null;
  topRegion: string | null;
  totalBottles: number;
};

const EMPTY_STATS: UserStats = {
  distinctRegions: 0,
  ratingCount: 0,
  scanCount: 0,
  topGrapeVariety: null,
  topRegion: null,
  totalBottles: 0,
};

export function useUserStats() {
  const user = useAuthStore((state) => state.user);

  return useQuery<UserStats, Error>({
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        return EMPTY_STATS;
      }

      const { data, error } = await supabase.rpc('user_stats', {
        p_user_id: user.id,
      });

      if (error) {
        throw error;
      }

      const row = data?.[0];

      if (!row) {
        return EMPTY_STATS;
      }

      return {
        distinctRegions: row.distinct_regions ?? 0,
        ratingCount: row.rating_count ?? 0,
        scanCount: row.scan_count ?? 0,
        topGrapeVariety: row.top_grape_variety,
        topRegion: row.top_region,
        totalBottles: row.total_bottles ?? 0,
      };
    },
    queryKey: ['user-stats', user?.id],
    staleTime: 60_000,
  });
}

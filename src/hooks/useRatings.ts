import {
  type InfiniteData,
  useInfiniteQuery,
} from '@tanstack/react-query';

import { batchSignedUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type RatingsFilters = {
  minStars?: 1 | 2 | 3 | 4 | 5;
  sortBy: 'best' | 'newest';
};

type RatingWine = Pick<
  Tables<'wines'>,
  'country' | 'id' | 'producer' | 'region' | 'wine_color' | 'wine_name'
>;

type RatingVintage = Pick<Tables<'vintages'>, 'id' | 'vintage_year'> & {
  wine: RatingWine | null;
};

type RatingScan = Pick<Tables<'scans'>, 'id' | 'label_image_url'> & {
  signed_url: string | null;
};

export type RatingListItem = Pick<
  Tables<'ratings'>,
  'created_at' | 'drank_at' | 'id' | 'notes' | 'occasion' | 'stars'
> & {
  scan: RatingScan | null;
  vintage: RatingVintage | null;
};

type RawRatingListItem = Pick<
  Tables<'ratings'>,
  'created_at' | 'drank_at' | 'id' | 'notes' | 'occasion' | 'stars'
> & {
  scan: Pick<Tables<'scans'>, 'id' | 'label_image_url'> | null;
  vintage: RatingVintage | null;
};

type RatingsPage = {
  data: RatingListItem[];
  nextPage?: number;
};

const RATINGS_PAGE_SIZE = 20;

async function createSignedUrlMap(rows: RawRatingListItem[]) {
  const paths = rows
    .map((row) => row.scan?.label_image_url)
    .filter((path): path is string => Boolean(path));

  return batchSignedUrls(paths);
}

function mapRatingListItem(
  item: RawRatingListItem,
  signedUrlMap: Record<string, string>
): RatingListItem {
  return {
    ...item,
    scan: item.scan
      ? {
          ...item.scan,
          signed_url: item.scan.label_image_url
            ? (signedUrlMap[item.scan.label_image_url] ?? null)
            : null,
        }
      : null,
  };
}

export function useRatings(filters: RatingsFilters) {
  return useInfiniteQuery<
    RatingsPage,
    Error,
    InfiniteData<RatingsPage>,
    [string, RatingsFilters],
    number
  >({
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam * RATINGS_PAGE_SIZE;
      const to = from + RATINGS_PAGE_SIZE - 1;
      let query = supabase
        .from('ratings')
        .select(
          `
            id,
            stars,
            notes,
            drank_at,
            occasion,
            created_at,
            scan:scans (
              id,
              label_image_url
            ),
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
        .range(from, to);

      if (filters.sortBy === 'newest') {
        query = query.order('drank_at', {
          ascending: false,
          nullsFirst: false,
        });
      } else {
        query = query
          .order('stars', { ascending: false })
          .order('drank_at', { ascending: false, nullsFirst: false });
      }

      if (filters.minStars) {
        query = query.gte('stars', filters.minStars);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as RawRatingListItem[];
      const signedUrlMap = await createSignedUrlMap(rows);

      return {
        data: rows.map((row) => mapRatingListItem(row, signedUrlMap)),
        nextPage:
          rows.length === RATINGS_PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    queryKey: ['ratings', filters],
    staleTime: 30_000,
  });
}

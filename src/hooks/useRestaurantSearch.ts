import { useQuery } from '@tanstack/react-query';

import { searchRestaurants } from '@/lib/restaurants';
import type {
  Coordinates,
  RestaurantBounds,
  RestaurantSearchFilters,
} from '@/types/restaurant';

type UseRestaurantSearchInput = {
  bounds: RestaurantBounds;
  center: Coordinates;
  filters?: RestaurantSearchFilters;
};

function roundCoordinate(value: number) {
  return Number(value.toFixed(3));
}

export function useRestaurantSearch({
  bounds,
  center,
  filters,
}: UseRestaurantSearchInput) {
  return useQuery({
    queryFn: () => searchRestaurants({ bounds, center, filters }),
    queryKey: [
      'restaurant-search',
      roundCoordinate(center.lat),
      roundCoordinate(center.lng),
      roundCoordinate(bounds.northEast.lat),
      roundCoordinate(bounds.northEast.lng),
      roundCoordinate(bounds.southWest.lat),
      roundCoordinate(bounds.southWest.lng),
      filters?.openNow ?? false,
      filters?.minRating ?? null,
      filters?.cuisine ?? null,
      filters?.cuisineTypes?.join(',') ?? null,
      filters?.priceLevels?.join(',') ?? null,
      filters?.radiusMeters ?? null,
    ],
    staleTime: 5 * 60 * 1000,
  });
}

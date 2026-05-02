import { useQuery } from '@tanstack/react-query';

import { getRestaurantDetails } from '@/lib/restaurants';
import { useAuthStore } from '@/stores/auth-store';
import type {
  Coordinates,
  RestaurantRecord,
} from '@/types/restaurant';

type UseRestaurantDetailInput = {
  center?: Coordinates;
  provider?: RestaurantRecord['provider'];
  providerPlaceId?: string;
  restaurantId?: string;
};

export function useRestaurantDetail(input: UseRestaurantDetailInput) {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    enabled: Boolean(
      user?.id && (input.restaurantId || input.providerPlaceId)
    ),
    queryFn: () => getRestaurantDetails(input),
    queryKey: [
      'restaurant-detail',
      user?.id,
      input.restaurantId ?? null,
      input.provider ?? null,
      input.providerPlaceId ?? null,
      input.center?.lat ?? null,
      input.center?.lng ?? null,
    ],
    staleTime: 10 * 60 * 1000,
  });
}

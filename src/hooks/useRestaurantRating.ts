import { useQuery } from '@tanstack/react-query';

import {
  ensureRestaurant,
  getRestaurantKey,
  getRestaurantRating,
} from '@/lib/restaurants';
import { useAuthStore } from '@/stores/auth-store';
import type {
  RestaurantRatingRecord,
  RestaurantRecord,
} from '@/types/restaurant';

type RestaurantRatingState = {
  rating: RestaurantRatingRecord | null;
  restaurantId: string;
};

export function useRestaurantRating(restaurant: RestaurantRecord | null) {
  const user = useAuthStore((state) => state.user);
  const restaurantKey = restaurant ? getRestaurantKey(restaurant) : null;

  return useQuery<RestaurantRatingState>({
    enabled: Boolean(user?.id && restaurant),
    queryFn: async () => {
      if (!restaurant) {
        throw new Error('Restaurant fehlt.');
      }

      const restaurantId = await ensureRestaurant(restaurant);
      const rating = await getRestaurantRating(restaurantId);

      return { rating, restaurantId };
    },
    queryKey: ['restaurant-rating', user?.id, restaurantKey],
    staleTime: 30_000,
  });
}

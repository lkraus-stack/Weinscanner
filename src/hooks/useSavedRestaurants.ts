import {
  useMemo,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  getRestaurantKey,
  getSavedRestaurants,
  removeSavedRestaurant,
  saveRestaurant,
} from '@/lib/restaurants';
import { useAuthStore } from '@/stores/auth-store';
import type { RestaurantRecord } from '@/types/restaurant';

export function useSavedRestaurants() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const queryKey = ['saved-restaurants', user?.id] as const;
  const query = useQuery({
    enabled: Boolean(user?.id),
    queryFn: getSavedRestaurants,
    queryKey,
    staleTime: 30_000,
  });
  const savedRestaurantKeys = useMemo(
    () =>
      new Set((query.data ?? []).map((restaurant) => restaurant.restaurantKey)),
    [query.data]
  );
  const saveMutation = useMutation({
    mutationFn: saveRestaurant,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const removeMutation = useMutation({
    mutationFn: removeSavedRestaurant,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    isSaved: (restaurant: RestaurantRecord) =>
      savedRestaurantKeys.has(getRestaurantKey(restaurant)),
    query,
    remove: removeMutation.mutateAsync,
    removeMutation,
    save: saveMutation.mutateAsync,
    saveMutation,
    savedRestaurantKeys,
  };
}

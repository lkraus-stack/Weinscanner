import { useMutation, useQuery } from '@tanstack/react-query';

import {
  analyzeRestaurants,
  getLatestRestaurantAiRecommendation,
  getRestaurantRecommendationRun,
} from '@/lib/restaurants';
import { useAuthStore } from '@/stores/auth-store';
import type {
  AnalyzeRestaurantsInput,
  RestaurantAiRecommendation,
  RestaurantRecommendationRun,
} from '@/types/restaurant';

export function useAnalyzeRestaurants() {
  return useMutation<RestaurantRecommendationRun, Error, AnalyzeRestaurantsInput>({
    mutationFn: analyzeRestaurants,
  });
}

export function useRestaurantRecommendationRun(runId?: string) {
  const user = useAuthStore((state) => state.user);

  return useQuery<RestaurantRecommendationRun>({
    enabled: Boolean(user?.id && runId),
    queryFn: () => getRestaurantRecommendationRun(runId ?? ''),
    queryKey: ['restaurant-ai-run', user?.id, runId],
    staleTime: 12 * 60 * 60 * 1000,
  });
}

export function useLatestRestaurantAiRecommendation(restaurantId?: string) {
  const user = useAuthStore((state) => state.user);

  return useQuery<RestaurantAiRecommendation | null>({
    enabled: Boolean(user?.id && restaurantId),
    queryFn: () => getLatestRestaurantAiRecommendation(restaurantId ?? ''),
    queryKey: ['restaurant-ai-analysis', user?.id, restaurantId],
    staleTime: 12 * 60 * 60 * 1000,
  });
}

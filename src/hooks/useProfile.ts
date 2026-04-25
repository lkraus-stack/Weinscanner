import { useQuery } from '@tanstack/react-query';

import { getProfile } from '@/lib/profile';
import { useAuthStore } from '@/stores/auth-store';

export function useProfile() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: getProfile,
    queryKey: ['profile', user?.id],
    staleTime: 60_000,
  });
}

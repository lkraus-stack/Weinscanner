import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  DEFAULT_USER_PREFERENCES,
  normalizePreferences,
  updateProfile,
  type ProfileWithAvatar,
  type UserPreferences,
} from '@/lib/profile';
import { useProfile } from '@/hooks/useProfile';

type UpdatePreferenceVariables<K extends keyof UserPreferences = keyof UserPreferences> = {
  key: K;
  value: UserPreferences[K];
};

export function usePreferences() {
  const queryClient = useQueryClient();
  const profileQuery = useProfile();
  const preferences = profileQuery.data
    ? normalizePreferences(profileQuery.data.preferences)
    : DEFAULT_USER_PREFERENCES;
  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ key, value }: UpdatePreferenceVariables) => {
      const nextPreferences = {
        ...preferences,
        [key]: value,
      };

      return updateProfile({ preferences: nextPreferences });
    },
    onSuccess: async (profile, variables) => {
      queryClient.setQueryData<ProfileWithAvatar | undefined>(
        ['profile', profile.id],
        (currentProfile) =>
          currentProfile
            ? { ...currentProfile, ...profile }
            : { ...profile, avatarSignedUrl: null }
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        variables.key === 'hide_empty_inventory'
          ? queryClient.invalidateQueries({ queryKey: ['inventory'] })
          : Promise.resolve(),
        variables.key === 'hide_empty_inventory'
          ? queryClient.invalidateQueries({ queryKey: ['inventory-stats'] })
          : Promise.resolve(),
      ]);
    },
  });

  return {
    ...profileQuery,
    isUpdatingPreference: updatePreferenceMutation.isPending,
    preferences,
    updatePreference: <K extends keyof UserPreferences>(
      key: K,
      value: UserPreferences[K]
    ) => updatePreferenceMutation.mutateAsync({ key, value }),
  };
}

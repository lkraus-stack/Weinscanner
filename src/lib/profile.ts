import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { compressImage } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import type { Json, Tables } from '@/types/database';

export type ProfileRecord = Tables<'profiles'>;

export type ThemePreference = 'auto' | 'dark' | 'light';

export type RestaurantDiscoveryPreferences = {
  cuisine_type: string | null;
  last_city: string | null;
  last_map_center: {
    lat: number;
    lng: number;
  } | null;
  min_rating: number | null;
  open_now: boolean;
  preferred_view: 'list' | 'map';
  quality_mode: 'off' | 'smart' | 'strict';
  radius_meters: number;
};

export type UserPreferences = {
  hide_empty_inventory: boolean;
  language: 'de';
  notifications_enabled: boolean;
  restaurant_discovery: RestaurantDiscoveryPreferences;
  theme: ThemePreference;
};

export type ProfileWithAvatar = ProfileRecord & {
  avatarSignedUrl: string | null;
};

type ProfileUpdates = {
  avatar_url?: string | null;
  display_name?: string | null;
  preferences?: UserPreferences;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  hide_empty_inventory: false,
  language: 'de',
  notifications_enabled: false,
  restaurant_discovery: {
    cuisine_type: null,
    last_city: null,
    last_map_center: null,
    min_rating: null,
    open_now: false,
    preferred_view: 'map',
    quality_mode: 'smart',
    radius_meters: 5000,
  },
  theme: 'auto',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalText(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function isRemoteUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function assertProfileError(error: { message?: string } | null) {
  if (error) {
    throw new Error(error.message ?? 'Profil konnte nicht gespeichert werden.');
  }
}

function normalizeTheme(value: unknown): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'auto') {
    return value;
  }

  return DEFAULT_USER_PREFERENCES.theme;
}

function normalizeMapCenter(value: unknown) {
  if (!isRecord(value)) {
    return DEFAULT_USER_PREFERENCES.restaurant_discovery.last_map_center;
  }

  const lat = typeof value.lat === 'number' ? value.lat : null;
  const lng = typeof value.lng === 'number' ? value.lng : null;

  if (lat === null || lng === null) {
    return DEFAULT_USER_PREFERENCES.restaurant_discovery.last_map_center;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return DEFAULT_USER_PREFERENCES.restaurant_discovery.last_map_center;
  }

  return { lat, lng };
}

function normalizeMinRating(value: unknown) {
  return value === 4 || value === 4.5
    ? value
    : DEFAULT_USER_PREFERENCES.restaurant_discovery.min_rating;
}

function normalizeRadiusMeters(value: unknown) {
  return value === 1000 ||
    value === 3000 ||
    value === 5000 ||
    value === 10000 ||
    value === 25000
    ? value
    : DEFAULT_USER_PREFERENCES.restaurant_discovery.radius_meters;
}

function normalizeQualityMode(value: unknown) {
  return value === 'off' || value === 'smart' || value === 'strict'
    ? value
    : DEFAULT_USER_PREFERENCES.restaurant_discovery.quality_mode;
}

function normalizeRestaurantDiscoveryPreferences(
  value: unknown
): RestaurantDiscoveryPreferences {
  if (!isRecord(value)) {
    return DEFAULT_USER_PREFERENCES.restaurant_discovery;
  }

  return {
    cuisine_type:
      typeof value.cuisine_type === 'string' && value.cuisine_type.trim()
        ? value.cuisine_type.trim()
        : DEFAULT_USER_PREFERENCES.restaurant_discovery.cuisine_type,
    last_city:
      typeof value.last_city === 'string' && value.last_city.trim()
        ? value.last_city.trim()
        : DEFAULT_USER_PREFERENCES.restaurant_discovery.last_city,
    last_map_center: normalizeMapCenter(value.last_map_center),
    min_rating: normalizeMinRating(value.min_rating),
    open_now:
      typeof value.open_now === 'boolean'
        ? value.open_now
        : DEFAULT_USER_PREFERENCES.restaurant_discovery.open_now,
    preferred_view: value.preferred_view === 'list' ? 'list' : 'map',
    quality_mode: normalizeQualityMode(value.quality_mode),
    radius_meters: normalizeRadiusMeters(value.radius_meters),
  };
}

export function normalizePreferences(value: Json | null): UserPreferences {
  if (!isRecord(value)) {
    return DEFAULT_USER_PREFERENCES;
  }

  return {
    hide_empty_inventory:
      typeof value.hide_empty_inventory === 'boolean'
        ? value.hide_empty_inventory
        : DEFAULT_USER_PREFERENCES.hide_empty_inventory,
    language: 'de',
    notifications_enabled:
      typeof value.notifications_enabled === 'boolean'
        ? value.notifications_enabled
        : DEFAULT_USER_PREFERENCES.notifications_enabled,
    restaurant_discovery: normalizeRestaurantDiscoveryPreferences(
      value.restaurant_discovery
    ),
    theme: normalizeTheme(value.theme),
  };
}

export async function createAvatarSignedUrl(
  avatarPath: string | null
): Promise<string | null> {
  if (!avatarPath) {
    return null;
  }

  if (isRemoteUrl(avatarPath)) {
    return avatarPath;
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(avatarPath, 3600);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function getProfile(): Promise<ProfileWithAvatar> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Nicht eingeloggt.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select()
    .eq('id', user.id)
    .maybeSingle();

  assertProfileError(error);

  const profile = data ?? (await ensureProfile());

  return {
    ...profile,
    avatarSignedUrl: await createAvatarSignedUrl(profile.avatar_url),
  };
}

export async function ensureProfile(): Promise<ProfileRecord> {
  const { data, error } = await supabase.rpc('ensure_profile');

  assertProfileError(error);

  if (!data) {
    throw new Error('Profil konnte nicht angelegt werden.');
  }

  return data;
}

export async function updateProfile(
  updates: ProfileUpdates
): Promise<ProfileRecord> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Nicht eingeloggt.');
  }

  const normalizedUpdates = {
    ...updates,
    ...(updates.display_name !== undefined
      ? { display_name: normalizeOptionalText(updates.display_name) }
      : {}),
    ...(updates.preferences ? { preferences: updates.preferences } : {}),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(normalizedUpdates)
    .eq('id', user.id)
    .select()
    .single();

  assertProfileError(error);

  if (!data) {
    throw new Error('Profil konnte nicht gespeichert werden.');
  }

  return data;
}

export async function uploadAvatar(localUri: string): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Nicht eingeloggt.');
  }

  const compressedImage = await compressImage(localUri, {
    maxWidth: 400,
    quality: 0.8,
  });
  const base64 = await FileSystem.readAsStringAsync(compressedImage.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const storagePath = `${user.id}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(storagePath, decode(base64), {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    throw new Error(error.message || 'Avatar konnte nicht hochgeladen werden.');
  }

  return storagePath;
}

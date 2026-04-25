import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { compressImage } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import type { Json, Tables } from '@/types/database';

export type ProfileRecord = Tables<'profiles'>;

export type ThemePreference = 'auto' | 'dark' | 'light';

export type UserPreferences = {
  hide_empty_inventory: boolean;
  language: 'de';
  notifications_enabled: boolean;
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
    .single();

  assertProfileError(error);

  if (!data) {
    throw new Error('Profil wurde nicht gefunden.');
  }

  return {
    ...data,
    avatarSignedUrl: await createAvatarSignedUrl(data.avatar_url),
  };
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

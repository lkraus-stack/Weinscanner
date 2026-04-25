import { decode } from 'base64-arraybuffer';

import type { SupabaseClient } from '@supabase/supabase-js';

export type UploadResult = {
  storagePath: string;
  signedUrl: string;
};

type StorageClient = Pick<SupabaseClient, 'storage'>;

const UPLOAD_ERROR_MESSAGE =
  'Foto konnte nicht hochgeladen werden. Bitte erneut versuchen.';

async function getAppSupabaseClient(): Promise<SupabaseClient> {
  const { supabase } = await import('@/lib/supabase');

  return supabase;
}

export async function uploadBuffer(
  userId: string,
  buffer: ArrayBuffer,
  fileName = `${Date.now()}.jpg`,
  client?: StorageClient
): Promise<UploadResult> {
  const storageClient = client ?? (await getAppSupabaseClient());
  const safeFileName = fileName.endsWith('.jpg') ? fileName : `${fileName}.jpg`;
  const storagePath = `${userId}/${safeFileName}`;

  try {
    const { error: uploadError } = await storageClient.storage
      .from('wine-labels')
      .upload(storagePath, buffer, {
        cacheControl: '3600',
        contentType: 'image/jpeg',
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: signedUrlData, error: signedUrlError } =
      await storageClient.storage
        .from('wine-labels')
        .createSignedUrl(storagePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw signedUrlError ?? new Error('Signed URL fehlt.');
    }

    return {
      storagePath,
      signedUrl: signedUrlData.signedUrl,
    };
  } catch {
    throw new Error(UPLOAD_ERROR_MESSAGE);
  }
}

export async function compressLocalImage(localUri: string): Promise<ArrayBuffer> {
  const [{ compressImage }, FileSystem] = await Promise.all([
    import('@/lib/image'),
    import('expo-file-system/legacy'),
  ]);
  const compressedImage = await compressImage(localUri);
  const base64 = await FileSystem.readAsStringAsync(compressedImage.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return decode(base64);
}

export async function uploadWineLabel(
  localUri: string
): Promise<UploadResult> {
  const supabase = await getAppSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Nicht eingeloggt');
  }

  try {
    const buffer = await compressLocalImage(localUri);

    return uploadBuffer(user.id, buffer, `${Date.now()}.jpg`, supabase);
  } catch (error) {
    if (error instanceof Error && error.message === 'Nicht eingeloggt') {
      throw error;
    }

    throw new Error(UPLOAD_ERROR_MESSAGE);
  }
}

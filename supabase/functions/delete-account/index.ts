import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  createServiceClient,
  errorResponse,
  handleCors,
  jsonResponse,
  requirePost,
  requireUser,
} from '../_shared/http.ts';

async function listUserStoragePaths(
  bucket: 'avatars' | 'wine-labels',
  userId: string
) {
  const supabase = createServiceClient();
  const paths: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(userId, {
      limit,
      offset,
    });

    if (error) {
      throw error;
    }

    const items = data ?? [];

    for (const item of items) {
      if (item.name) {
        paths.push(`${userId}/${item.name}`);
      }
    }

    if (items.length < limit) {
      break;
    }

    offset += limit;
  }

  return paths;
}

async function removeUserStorage(bucket: 'avatars' | 'wine-labels', userId: string) {
  const paths = await listUserStoragePaths(bucket, userId);

  if (paths.length === 0) {
    return;
  }

  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(bucket).remove(paths);

  if (error) {
    throw error;
  }
}

serve(async (req) => {
  const corsResponse = handleCors(req);

  if (corsResponse) {
    return corsResponse;
  }

  try {
    requirePost(req);

    const user = await requireUser(req);
    const supabase = createServiceClient();

    await Promise.all([
      removeUserStorage('wine-labels', user.id),
      removeUserStorage('avatars', user.id),
    ]);

    const { error } = await supabase.auth.admin.deleteUser(user.id);

    if (error) {
      throw error;
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
});

import { assertOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase('de-DE');
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (
    error &&
    typeof error === 'object' &&
    'context' in error &&
    (error as { context?: unknown }).context instanceof Response
  ) {
    try {
      const errorBody = await (error as { context: Response }).context.json();

      if (
        errorBody &&
        typeof errorBody === 'object' &&
        'error' in errorBody &&
        typeof (errorBody as { error: unknown }).error === 'string'
      ) {
        return (errorBody as { error: string }).error;
      }
    } catch {
      return 'Account konnte nicht gelöscht werden.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Account konnte nicht gelöscht werden.';
}

export async function deleteAccount(confirmEmail: string): Promise<void> {
  await assertOnline();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    throw new Error('Nicht eingeloggt.');
  }

  if (normalizeEmail(confirmEmail) !== normalizeEmail(user.email)) {
    throw new Error('Die E-Mail stimmt nicht überein.');
  }

  const { data, error } = await supabase.functions.invoke<{
    error?: string;
    success?: boolean;
  }>('delete-account', {
    body: {},
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  await supabase.auth.signOut();
}

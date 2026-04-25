import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

// useAuth owns the global auth subscription and must be called exactly once
// from app/_layout.tsx. Other components should read auth state via
// useAuthStore() and call supabase.auth directly for auth actions.
function readAuthTokens(url: string) {
  const parsed = Linking.parse(url);
  const queryParams = parsed.queryParams ?? {};
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const fragmentParams = new URLSearchParams(fragment);

  const accessToken =
    typeof queryParams.access_token === 'string'
      ? queryParams.access_token
      : fragmentParams.get('access_token');
  const refreshToken =
    typeof queryParams.refresh_token === 'string'
      ? queryParams.refresh_token
      : fragmentParams.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

async function handleAuthCallbackUrl(url: string) {
  const tokens = readAuthTokens(url);

  if (!tokens) {
    return;
  }

  const { error } = await supabase.auth.setSession(tokens);

  if (error) {
    throw error;
  }
}

export function useAuth() {
  const { session, user, isLoading, setSession, setLoading } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    Linking.getInitialURL().then((url) => {
      if (!url) return;
      handleAuthCallbackUrl(url).catch((error: unknown) => {
        console.error('Auth-Callback konnte nicht verarbeitet werden:', error);
      });
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthCallbackUrl(url).catch((error: unknown) => {
        console.error('Auth-Callback konnte nicht verarbeitet werden:', error);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, [setLoading, setSession]);

  return { session, user, isLoading };
}

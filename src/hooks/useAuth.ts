import * as Linking from 'expo-linking';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

// useAuth owns the global auth subscription and must be called exactly once
// from app/_layout.tsx. Other components should read auth state via
// useAuthStore() and call supabase.auth directly for auth actions.
function readAuthCallback(url: string) {
  const parsed = Linking.parse(url);
  const queryParams = parsed.queryParams ?? {};
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const fragmentParams = new URLSearchParams(fragment);
  const routePath = [parsed.hostname, parsed.path].filter(Boolean).join('/');

  const accessToken =
    typeof queryParams.access_token === 'string'
      ? queryParams.access_token
      : fragmentParams.get('access_token');
  const refreshToken =
    typeof queryParams.refresh_token === 'string'
      ? queryParams.refresh_token
      : fragmentParams.get('refresh_token');
  const type =
    typeof queryParams.type === 'string'
      ? queryParams.type
      : fragmentParams.get('type');
  const code =
    typeof queryParams.code === 'string'
      ? queryParams.code
      : fragmentParams.get('code');
  const isPasswordRecovery =
    type === 'recovery' || routePath.includes('reset-password');

  if ((!accessToken || !refreshToken) && !code) {
    return null;
  }

  return {
    access_token: accessToken,
    code,
    isPasswordRecovery,
    refresh_token: refreshToken,
  };
}

async function handleAuthCallbackUrl(
  url: string,
  setPasswordRecovery: (isPasswordRecovery: boolean) => void
) {
  const callback = readAuthCallback(url);

  if (!callback) {
    return;
  }

  const { access_token: accessToken, code, refresh_token: refreshToken } =
    callback;
  const { error } =
    accessToken && refreshToken
      ? await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      : await supabase.auth.exchangeCodeForSession(code ?? '');

  if (error) {
    throw error;
  }

  setPasswordRecovery(callback.isPasswordRecovery);
}

export function useAuth() {
  const {
    clearPasswordRecovery,
    isLoading,
    isPasswordRecovery,
    session,
    setLoading,
    setPasswordRecovery,
    setSession,
    user,
  } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    const handledUrls = new Set<string>();
    const handleIncomingUrl = (url: string) => {
      if (handledUrls.has(url)) {
        return;
      }

      handledUrls.add(url);
      handleAuthCallbackUrl(url, setPasswordRecovery).catch((error: unknown) => {
        console.error('Auth-Callback konnte nicht verarbeitet werden:', error);
      });
    };

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
      handleIncomingUrl(url);
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        setPasswordRecovery(false);
      }

      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, [setLoading, setPasswordRecovery, setSession]);

  return {
    clearPasswordRecovery,
    isLoading,
    isPasswordRecovery,
    session,
    user,
  };
}

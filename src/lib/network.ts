import NetInfo from '@react-native-community/netinfo';

import { useToastStore } from '@/stores/toast-store';

export const OFFLINE_MESSAGE = 'Keine Internet-Verbindung.';

export async function assertOnline() {
  const state = await NetInfo.fetch();
  const isOffline =
    state.isConnected === false || state.isInternetReachable === false;

  if (!isOffline) {
    return;
  }

  useToastStore.getState().showToast(OFFLINE_MESSAGE);
  throw new Error(OFFLINE_MESSAGE);
}

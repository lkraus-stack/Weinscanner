import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';

export type AppPermissionState =
  | 'granted'
  | 'limited'
  | 'denied'
  | 'undetermined';

export type AppPermissionResult = {
  status: AppPermissionState;
  granted: boolean;
  canAskAgain: boolean;
};

type PermissionLike = {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
  accessPrivileges?: string | null;
};

function mapPermission(
  permission: PermissionLike,
  options?: { supportsLimited?: boolean }
): AppPermissionResult {
  if (permission.granted) {
    return {
      status:
        options?.supportsLimited &&
        permission.accessPrivileges === 'limited' ? 'limited' : 'granted',
      granted: true,
      canAskAgain: permission.canAskAgain,
    };
  }

  return {
    status: permission.status === 'undetermined' ? 'undetermined' : 'denied',
    granted: false,
    canAskAgain: permission.canAskAgain,
  };
}

export async function getCameraPermission(): Promise<AppPermissionResult> {
  const permission = await Camera.getCameraPermissionsAsync();

  return mapPermission(permission);
}

export async function requestCameraPermission(): Promise<boolean> {
  const currentPermission = await getCameraPermission();

  if (currentPermission.granted) {
    return true;
  }

  if (
    currentPermission.status === 'denied' &&
    !currentPermission.canAskAgain
  ) {
    return false;
  }

  const nextPermission = await Camera.requestCameraPermissionsAsync();

  return mapPermission(nextPermission).granted;
}

export async function getMediaLibraryPermission(): Promise<AppPermissionResult> {
  const permission = await ImagePicker.getMediaLibraryPermissionsAsync();

  return mapPermission(permission, { supportsLimited: true });
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  const currentPermission = await getMediaLibraryPermission();

  if (currentPermission.granted) {
    return true;
  }

  if (
    currentPermission.status === 'denied' &&
    !currentPermission.canAskAgain
  ) {
    return false;
  }

  const nextPermission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  return mapPermission(nextPermission, { supportsLimited: true }).granted;
}

export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}

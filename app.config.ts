import type { ConfigContext, ExpoConfig } from 'expo/config';

const placeholderAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1wbGFjZWhvbGRlciIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder-fake-signature-do-not-use';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Wine Scanner',
  slug: 'wine-scanner',
  scheme: 'winescanner',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FAF7F2',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.francoconsulting.winescanner',
    buildNumber: '1',
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription:
        'Wir benötigen Zugriff auf deine Kamera, um Weinetiketten zu scannen.',
      NSPhotoLibraryUsageDescription:
        'Wir benötigen Zugriff auf deine Fotos, um Weinetiketten zu importieren.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FAF7F2',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-apple-authentication'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...config.extra,
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? placeholderAnonKey,
  },
});

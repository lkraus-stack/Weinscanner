# Wine Scanner

Native iOS Wein-Scanner-App auf Basis von Expo, React Native und TypeScript.

## Voraussetzungen

- Node.js 22 LTS, im Repo über `.nvmrc` gepinnt
- npm 10+
- Expo CLI über `npx expo`
- Supabase-Projekt mit URL und Anon Key

## Quick Start

```bash
nvm use
npm install
npx expo start
```

## Lokale Env

Kopiere die Werte aus deinem Supabase-Projekt in `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://dein-projekt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
```

`.env.local` ist gitignored. `.env.example` bleibt ohne Secrets im Repo.

## Nützliche Checks

```bash
npx tsc --noEmit
npx expo lint
```

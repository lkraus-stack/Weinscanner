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

## Edge Function Secrets

Die KI-Analyse läuft über Vantero in Supabase Edge Functions. Das Mobile-Bundle
enthält keinen KI-Key. Das Standardmodell ist `chat-model-gemini-2.5-flash`.
Falls du das Modell explizit als Supabase Secret setzt oder dort noch ein
alter Wert steht, nutze:

```bash
VANTERO_MODEL_ID=chat-model-gemini-2.5-flash
```

## Nützliche Checks

```bash
npx tsc --noEmit
npx expo lint
```

## Tested manually

- Sprint 06: KI-Analyse, Confirmation-Screen und Jahrgangs-Fallback in Expo Go getestet.

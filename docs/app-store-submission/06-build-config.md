# Build und Submission Konfiguration

Stand: 2026-04-26

Quellen:

- Expo App Version Management: https://docs.expo.dev/build-reference/app-versions/
- Expo EAS Environment Variables: https://docs.expo.dev/eas/environment-variables/
- Expo Using Sentry: https://docs.expo.dev/guides/using-sentry/

## EAS Build Profile

`eas.json` trennt die Build-Profile wie folgt:

| Profil | Zweck | Distribution | Channel | iOS |
| --- | --- | --- | --- | --- |
| development | Development Client und lokale Tests | internal | kein Channel | Simulator, `m-medium` |
| preview | Interne Geraetetests vor Submission | internal | `preview` | Device Build, `m-medium` |
| production | App Store / TestFlight Build | store default | `production` | Device Build, `m-medium` |

`cli.appVersionSource` ist auf `remote` gesetzt. Dadurch verwaltet EAS die technische Build-Version remote. `production.autoIncrement` ist aktiv, damit App Store Uploads nicht wegen doppelter Build-Nummern scheitern.

## Submit Profile

`submit.production.ios` ist fuer App Store Connect vorbereitet:

- `ascAppId`: `6763864187`
- `appleTeamId`: `4Q33M4DTL3`

Diese Werte sind in `eas.json` eingetragen.

Moegliche Wege:

```sh
eas submit --platform ios --profile production
```

oder direkte Uebergabe beim Submit:

```sh
eas submit --platform ios --profile production --latest
```

Wenn die Platzhalter nicht in `eas.json` gepflegt werden sollen, koennen die echten IDs auch interaktiv oder ueber CLI-Flags beim Submit angegeben werden.

## Sentry Source Maps

Die App nutzt den Expo-kompatiblen Sentry Config Plugin Pfad:

```ts
['@sentry/react-native/expo', {
  organization: 'franco-consulting',
  project: 'wine-scanner',
}]
```

Der Auth Token wird nicht committed. Fuer EAS Builds muss `SENTRY_AUTH_TOKEN` als Secret oder Environment Variable gesetzt sein. Laut Expo/Sentry wird der Source-Map-Upload bei EAS Build dann automatisch ausgefuehrt.

Setzen des Tokens:

```sh
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
```

Falls die moderne EAS-Environment-Verwaltung genutzt wird:

```sh
eas env:create --environment production --name SENTRY_AUTH_TOKEN --value <token> --visibility secret
```

Pruefen:

```sh
eas secret:list
```

oder:

```sh
eas env:list --environment production
```

Das bestehende Script bleibt als Fallback fuer EAS Update oder manuelle Uploads erhalten:

```sh
npm run sentry:upload-sourcemaps
```

## EAS Environment Variables

Keine echten Supabase-, Sentry- oder Apple-Secrets werden in `eas.json` committed.

Folgende Werte muessen fuer Production in EAS gepflegt werden:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

Die Franco-Consulting URLs fuer Datenschutz, Impressum, Support und Marketing sind bereits im Code ueber `src/lib/links.ts` abgedeckt. Sie muessen nicht doppelt in `eas.json` gepflegt werden.

## Build-Kommandos

Preview Build fuer internes Testen:

```sh
eas build --platform ios --profile preview
```

Production Build fuer TestFlight/App Store:

```sh
eas build --platform ios --profile production
```

Submission nach App Store Connect:

```sh
eas submit --platform ios --profile production --latest
```

## Offene Punkte

Vor dem finalen Submit muss geprueft werden, ob `SENTRY_AUTH_TOKEN`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` in der EAS Production-Umgebung gesetzt sind.

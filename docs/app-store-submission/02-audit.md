# Sprint 17 Finaler Audit-Pass

Datum: 2026-04-26

Ziel: Systematische Verifikation der Sprint-1-bis-17-Anforderungen fuer App-Store-Readiness. Dieser Pass ist reine Verifikation und Dokumentation. Es wurden keine App-Code-Changes vorgenommen.

## 1. Code-Audit

### 1.1 TypeScript Strict-Check

Command:

```sh
npx tsc --noEmit
```

Status: OK

Output:

```txt
(kein Output)
```

Ergebnis: Exit Code 0. `tsconfig.json` hat `compilerOptions.strict: true`.

### 1.2 Lint

Command:

```sh
npx expo lint
```

Status: OK

Output:

```txt
env: load .env.local
env: export EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_SENTRY_DSN SENTRY_ORG SENTRY_PROJECT
```

Ergebnis: Exit Code 0. Keine Errors, keine Warnings im Lint-Output.

### 1.3 Expo Doctor

Command:

```sh
npx expo-doctor
```

Status: OK nach Cleanup

Output:

```txt
Running 17 checks on your project...
17/17 checks passed. No issues detected!
```

Cleanup vom 2026-04-26:

- `sentry-expo` entfernt.
- `npm ls @sentry/react-native sentry-expo @react-native-community/netinfo` zeigt nur noch `@sentry/react-native@7.2.0` und `@react-native-community/netinfo@11.4.1`.
- `sentry:upload-sourcemaps` nutzt explizit `node_modules/@sentry/react-native/scripts/expo-upload-sourcemaps.js`.
- `@react-native-community/netinfo` wurde via `npx expo install @react-native-community/netinfo` auf die Expo-SDK-54-kompatible Version `11.4.1` gepinnt.

### 1.4 NPM Audit

Command:

```sh
npm audit
```

Status: WARNUNG

Output-Zusammenfassung:

```txt
15 moderate severity vulnerabilities

Directly reported moderate advisories:
- postcss <8.5.10
- uuid <14.0.0

To address all issues (including breaking changes), run:
  npm audit fix --force
```

Bewertung: Keine critical oder high Findings. Moderate Findings sind fuer jetzt akzeptabel. Die vorherigen Sentry-Findings aus der alten `sentry-expo`-Dependency-Kette sind nach dem Cleanup nicht mehr im Audit-Output.

### 1.5 Konventions-Checks

| Check | Status | Output |
| --- | --- | --- |
| `rg "console\.log" app src` | OK | leer |
| `rg "—|–" app src` | OK | leer |
| `rg "from '@/theme/colors'" app src -g '!src/theme/**'` | OK | leer |
| `rg "#[A-Fa-f0-9]{6}" app src -g '!src/theme/colors.ts'` | OK | leer |

### 1.6 Tests

| Command | Status | Output-Auszug |
| --- | --- | --- |
| `npm run test:storage` | PASS | Upload, Signed URL, Bucket-Datei, Groesse und Cleanup validiert |
| `npm run test:save-scan` | PASS | Manual Save und Cache Save erfolgreich, DB-Zeilen und `ai_feedback` validiert |
| `npm run test:history` | PASS | 25 Scans erstellt, Pagination, Suche, Weinfarben-Filter und User-Isolation validiert |
| `npm run test:scan-wine` | PASS mit Hinweis | Fresh-Run, Cache-Run, anderer Wein und Cleanup erfolgreich. No-vintage-Schaetzungstest wurde uebersprungen, weil `SCAN_WINE_NO_VINTAGE_IMAGE_PATH` oder `SCAN_WINE_NO_VINTAGE_IMAGE_URL` in `.env.test` fehlt |
| `npm run test:extract-wine` | PASS | Lokales Test-Etikett hochgeladen, `extract-wine` erfolgreich, Storage-Cleanup erfolgreich |

## 2. Konfig-Audit

### 2.1 `app.config.ts`

| Anforderung | Ist-Wert | Status |
| --- | --- | --- |
| `name` | `Wine Scanner` | OK |
| `version` | `1.0.0` | OK |
| `ios.buildNumber` | `1` | OK |
| `ios.bundleIdentifier` | `com.francoconsulting.winescanner` | OK |
| `ios.config.usesNonExemptEncryption` | `false` | OK |
| `ios.privacyManifests` | vorhanden, siehe finaler Config-Auszug unten | OK |
| `NSCameraUsageDescription` | `Wir benötigen Zugriff auf deine Kamera, um Weinetiketten zu scannen.` | OK |
| `NSPhotoLibraryUsageDescription` | `Wir benötigen Zugriff auf deine Fotos, um Weinetiketten zu importieren.` | OK |
| `usesAppleSignIn` | `true` | OK |
| Sentry-Plugin | `@sentry/react-native/expo` mit `organization: franco-consulting`, `project: wine-scanner` | OK mit Doctor-Blocker fuer Dependency-Tree |

Resolved Config-Auszug:

```json
{
  "name": "Wine Scanner",
  "version": "1.0.0",
  "ios": {
    "buildNumber": "1",
    "bundleIdentifier": "com.francoconsulting.winescanner",
    "usesAppleSignIn": true,
    "usesNonExemptEncryption": false,
    "NSCameraUsageDescription": "Wir benötigen Zugriff auf deine Kamera, um Weinetiketten zu scannen.",
    "NSPhotoLibraryUsageDescription": "Wir benötigen Zugriff auf deine Fotos, um Weinetiketten zu importieren."
  },
  "plugins": [
    "expo-router",
    "expo-secure-store",
    "expo-apple-authentication",
    "@react-native-community/datetimepicker",
    [
      "@sentry/react-native/expo",
      {
        "organization": "franco-consulting",
        "project": "wine-scanner"
      }
    ],
    [
      "expo-camera",
      {
        "cameraPermission": "Wir benötigen Zugriff auf deine Kamera, um Weinetiketten zu scannen.",
        "recordAudioAndroid": false
      }
    ]
  ]
}
```

### 2.2 `eas.json`

| Anforderung | Status | Notiz |
| --- | --- | --- |
| Drei Build-Profile | OK | `development`, `preview`, `production` vorhanden |
| `production.autoIncrement` | OK | `true` |
| `submit.production.ios.ascAppId` | OK | `6763864187` |
| `submit.production.ios.appleTeamId` | OK | `4Q33M4DTL3` |

Bewertung: Build-Profile und Submit-IDs sind bereit.

### 2.3 Privacy Manifest Verifikation

Command:

```sh
npx expo config --json > /tmp/wine-config-final.json
node -e "const c = require('/tmp/wine-config-final.json'); console.log(JSON.stringify(c.ios?.privacyManifests || {}, null, 2));"
```

Output:

```json
{
  "NSPrivacyTracking": false,
  "NSPrivacyTrackingDomains": [],
  "NSPrivacyCollectedDataTypes": [
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress",
      "NSPrivacyCollectedDataTypeLinked": true,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": [
        "NSPrivacyCollectedDataTypePurposeAppFunctionality"
      ]
    },
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeUserID",
      "NSPrivacyCollectedDataTypeLinked": true,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": [
        "NSPrivacyCollectedDataTypePurposeAppFunctionality"
      ]
    },
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypePhotosOrVideos",
      "NSPrivacyCollectedDataTypeLinked": false,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": [
        "NSPrivacyCollectedDataTypePurposeAppFunctionality"
      ]
    },
    {
      "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeCrashData",
      "NSPrivacyCollectedDataTypeLinked": false,
      "NSPrivacyCollectedDataTypeTracking": false,
      "NSPrivacyCollectedDataTypePurposes": [
        "NSPrivacyCollectedDataTypePurposeAppFunctionality"
      ]
    }
  ],
  "NSPrivacyAccessedAPITypes": [
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
      "NSPrivacyAccessedAPITypeReasons": [
        "CA92.1"
      ]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
      "NSPrivacyAccessedAPITypeReasons": [
        "C617.1"
      ]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
      "NSPrivacyAccessedAPITypeReasons": [
        "E174.1"
      ]
    }
  ]
}
```

Bewertung: Manifest ist vorhanden und deckt E-Mail, User ID, Photos/Videos, Crash Data und Required Reason APIs ab.

### 2.4 `src/lib/links.ts`

| Link | Wert | Status |
| --- | --- | --- |
| `privacy` | `https://www.franco-consulting.com/datenschutz` | OK |
| `imprint` | `https://www.franco-consulting.com/impressum` | OK |
| `support` | `https://www.franco-consulting.com/kontakt` | OK |
| `marketing` | `https://www.franco-consulting.com` | OK |

Profile-Tab-Verlinkung:

- `LINKS.privacy` ist in `app/(app)/profile.tsx` als Datenschutz-Zeile verlinkt.
- `LINKS.imprint` ist in `app/(app)/profile.tsx` als Impressum-Zeile verlinkt.
- `support` und `marketing` sind korrekt zentral hinterlegt und in der App-Store-Checklist vorgesehen, aber aktuell nicht als Profile-Zeilen sichtbar. Das ist fuer die App-Store-Pflichtfelder kein Blocker, falls Profile bewusst nur Datenschutz und Impressum zeigt.

## 3. UX-Audit, manuell durch Lukas

Codex hat die Code-Pfade und Konfigurationen geprueft. Die folgenden Punkte muessen auf einem echten iOS-Build oder mindestens in einem realistischen Development Build manuell validiert werden.

| Bereich | Manueller Check | Status |
| --- | --- | --- |
| Permission-Dialoge | Camera-Permission Dialog zeigt deutschen Text | Offen |
| Permission-Dialoge | Photos-Permission Dialog zeigt deutschen Text | Offen |
| Permission-Denied | Kamera-Fallback-UI ueber `PermissionDeniedView` funktional | Offen |
| Permission-Denied | Galerie/Avatar Denied-Flows zeigen sinnvolle Fehlermeldung | Offen |
| Auth | Email-OTP Login | Offen |
| Auth | Apple Sign-In Login | Offen |
| Auth | Logout | Offen |
| Auth | Account-Loeschung mit Test-Account | Offen |
| Empty States | Verlauf leer | Offen |
| Empty States | Bewertet leer | Offen |
| Empty States | Bestand leer | Offen |
| Empty States | Profile bei neuem User | Offen |
| Error States | Offline-Banner erscheint | Offen |
| Error States | Error-Boundary faengt Errors | Offen |
| Error States | Toast oder Alert bei Edge-Function-Fehlern | Offen |
| Theme | Hell-Mode komplett funktional | Offen |
| Theme | Dark-Mode komplett funktional | Offen |
| Theme | Auto-Mode folgt System-Theme | Offen |

Code-Hinweise: `OfflineBanner`, `ErrorBoundary`, `ThemeProvider`, `EmptyState`, `EmailOtpForm`, `AppleSignInButton` und `DeleteAccountModal` sind vorhanden.

## 4. Funktional-Audit, manuell durch Lukas

| Schritt | Flow | Status |
| --- | --- | --- |
| 1 | Sign-Up und Login | Offen |
| 2 | Wein scannen, Kamera | Offen |
| 3 | Wein scannen, Galerie | Offen |
| 4 | Confirmation mit Pflicht-Jahrgang | Offen |
| 5 | Confirmation mit Schaetzungs-Jahrgang | Offen |
| 6 | Wein bewerten | Offen |
| 7 | Wein in Bestand legen | Offen |
| 8 | Bestand: Eine-getrunken-Quick-Action | Offen |
| 9 | Wein-Korrektur, anderer Jahrgang | Offen |
| 10 | Scan loeschen | Offen |
| 11 | Profil-Edit, Avatar und Name | Offen |
| 12 | Theme wechseln, Hell, Dunkel, Auto | Offen |
| 13 | Daten exportieren, CSV und JSON | Offen |
| 14 | Datenschutz-Link oeffnet externe URL | Offen |
| 15 | Impressum-Link oeffnet externe URL | Offen |
| 16 | Account loeschen mit Test-Account | Offen |

Automatisierte Abdeckung: Storage, Save-Scan, History, Scan-Wine und Extract-Wine laufen durch. Der manuelle UX- und End-to-End-Pass bleibt trotzdem vor TestFlight erforderlich.

## 5. Security-Audit

### 5.1 Keine API-Keys im Mobile-Bundle

| Check | Status | Output |
| --- | --- | --- |
| `rg "sk_" app src` | OK | leer |
| `rg "service_role" app src` | OK | leer |

Ergaenzender Repo-Check: `SUPABASE_SERVICE_ROLE_KEY` kommt in `supabase/functions/_shared/http.ts` und in lokalen Test-/Dev-Scripts vor. Keine Treffer in `app` oder `src`.

### 5.2 RLS-Verifikation

Status: OK auf Migrations-Ebene, Dashboard-Check offen.

Gepruefte Migration: `supabase/migrations/20260425000500_rls_policies.sql`

- `profiles`, `wines`, `vintages`, `scans`, `ratings`, `inventory_items`, `ai_feedback` haben `ENABLE ROW LEVEL SECURITY`.
- `scans`, `ratings`, `inventory_items`, `profiles` sind user-scoped.
- `wines` und `vintages` haben nur SELECT fuer `authenticated`.
- History-Test validiert, dass ein fremder User keine Scans sieht.

Manuell in Supabase Dashboard final pruefen: RLS aktiv fuer `scans`, `ratings`, `inventory_items`, `profiles`, `wines`, `vintages`.

### 5.3 Edge Functions Auth-Check

| Function | Auth-Check | Status |
| --- | --- | --- |
| `scan-wine` | `requirePost(req)` und `await requireUser(req)` | OK |
| `save-scan` | `requirePost(req)`, `await requireUser(req)`, Bearer Token fuer User-Client | OK |
| `delete-account` | `requirePost(req)` und `await requireUser(req)` vor Service-Role-Delete | OK |

Service-Role wird ueber `createServiceClient()` nur in Supabase Edge Functions genutzt. Mobile-Code (`app`, `src`) enthaelt keinen Service-Role-Key.

### 5.4 Storage RLS

| Bucket | Erwartung | Ist-Stand | Status |
| --- | --- | --- | --- |
| `wine-labels` | User darf nur eigene Labels uploaden/lesen | Bucket privat, Insert/Select per `auth.uid() == foldername[1]` | OK |
| `avatars` | User darf nur eigenen Avatar uploaden/lesen | Bucket ist `public: false`, Own-Select/Insert/Update/Delete per `auth.uid() == foldername[1]` | OK |

Cleanup vom 2026-04-26:

- Migration `20260426145318_avatars_own_read.sql` angelegt und per `npx supabase db push` deployed.
- `avatars` Bucket auf privat gesetzt.
- Public-Read-Policies `Public avatars are readable` und `Avatars are publicly accessible` gedroppt.
- Own-Read-Policy `Users can view own avatars` ergaenzt.
- Own-Write-Policies fuer Insert, Update und Delete verifiziert bzw. idempotent abgesichert.
- `src/lib/profile.ts` nutzt bereits `createSignedUrl(avatarPath, 3600)` und der Profile-Tab rendert `avatarSignedUrl`.
- Backendnaher Test: Auth-Upload OK, Signed URL OK, Public URL unauthenticated Status `400`, Cleanup OK.

## 6. Submission-Readiness

| Sektion | Status | Notiz |
| --- | --- | --- |
| Apple Developer Account | Pending | Muss von Lukas bestaetigt werden |
| Bundle ID registriert | Pending | `com.francoconsulting.winescanner` |
| App in App Store Connect | Pending | `Wine Scanner` |
| App Privacy Setup | Pending | Sprint 18 nach Build |
| Listing-Texte | Bereit | aus `07-listing-texts.md` |
| Screenshots | Pending | Sprint 18 |
| App Icon | Bereit, Upload Pending | `assets/icon.png` ist 1024x1024 PNG ohne Alpha; Upload in App Store Connect folgt in Sprint 18 |
| Privacy URL | OK | `https://www.franco-consulting.com/datenschutz` |
| Marketing URL | OK | `https://www.franco-consulting.com` |
| Support URL | OK | `https://www.franco-consulting.com/kontakt` |
| Test-Account | Pending | Sprint 18 |
| Demo-Notes | Bereit | aus `01-checklist.md` |

## 7. Identifizierte Blocker

| Severity | Blocker | Evidenz | Fix-Vorschlag |
| --- | --- | --- | --- |
| - | Keine aktiven technischen Blocker | `npx expo-doctor` gruen, Avatar-Storage private Own-Read | Manueller UX-/Funktional-Audit bleibt offen |

Behoben:

- P1 `expo-doctor` rot wegen Sentry-Peers, Duplicate Dependencies und NetInfo-Mismatch. Nach `sentry-expo`-Removal und NetInfo-Pin auf `11.4.1` ist `npx expo-doctor` gruen mit `17/17 checks passed`.
- P2 Avatar-Bucket public-read. Nach Migration `20260426145318_avatars_own_read.sql` ist `avatars.public = false`; Storage-Policies erlauben SELECT/INSERT/UPDATE/DELETE nur fuer eigene Avatar-Pfade.

## 8. Hinweise und Rest-Risiken

- `npm audit` meldet 15 moderate Findings, keine critical/high. `npm audit fix --force` wuerde aktuell breaking changes vorschlagen und wird daher nicht automatisch ausgefuehrt.
- `test:scan-wine` hat bestanden, aber der No-vintage-Schaetzungstest wurde wegen fehlender Testbild-Env uebersprungen. Vor Release sollte der manuelle Flow "Confirmation mit Schaetzungs-Jahrgang" zwingend getestet werden.
- `eas.json` enthaelt echte Submit-IDs fuer App Store Connect und Apple Team.
- `support` und `marketing` sind als zentrale Links korrekt hinterlegt, aber nicht als sichtbare Profile-Zeilen verlinkt. Das ist nur relevant, falls Profile alle vier Links zeigen soll.

## 9. Empfehlung zum naechsten Schritt

Sprint 17 Audit ist abgeschlossen. Die technischen Blocker P1 und P2 sind behoben. Vor Sprint 18 bleibt der manuelle UX-/Funktional-Audit offen.

Empfohlene Reihenfolge:

1. Manuellen UX- und Funktional-Audit auf iOS Development/Preview Build durchfuehren.
2. Wenn die offenen Punkte geklaert sind: Sprint 18 starten, erster Production Build und TestFlight.

# Sprint 17 Privacy Audit

Stand: 2026-04-26

## Kontext

Wine Scanner ist aktuell ein managed Expo-Projekt ohne committed `ios/`-Ordner. Das iOS Privacy Manifest wird deshalb ueber `ios.privacyManifests` in `app.config.ts` gepflegt. Expo generiert daraus beim nativen Build die `PrivacyInfo.xcprivacy`.

Quellen:

- Expo Privacy Manifests: https://docs.expo.dev/guides/apple-privacy/
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/

## Tracking

- `NSPrivacyTracking`: `false`
- `NSPrivacyTrackingDomains`: leer

Begruendung: Die App nutzt keine Werbung, keine Datenbroker und kein Cross-App-Tracking.

## Gesammelte Datenarten

| Datentyp | Linked | Tracking | Zweck | Begruendung |
| --- | --- | --- | --- | --- |
| Email Address | Ja | Nein | App Functionality | Login per Email/OTP und Account-Verwaltung ueber Supabase Auth. |
| User ID | Ja | Nein | App Functionality | Supabase User-ID verknuepft Profile, Scans, Bewertungen und Bestand. |
| Photos or Videos | Nein | Nein | App Functionality | Weinetikett-Fotos sind User-generated Content und werden nicht als Identifier fuer den User verwendet. |
| Crash Data | Nein | Nein | App Functionality | Sentry wird fuer Crash- und Error-Diagnostik genutzt. Im App-Code wird kein Supabase-User an Sentry gesetzt. |

Wichtige Korrektur: Fotos sind in dieser App `Not Linked`, weil sie als Content-Daten fuer Wein-Erkennung und Verlauf gespeichert werden und nicht als Identifier fuer den User dienen.

## Required Reason APIs

| API-Kategorie | Reason | Begruendung |
| --- | --- | --- |
| UserDefaults | CA92.1 | React Native, Expo und App-Persistenz koennen lokale Defaults nutzen. |
| File Timestamp | C617.1 | Expo FileSystem und lokale Dateioperationen koennen Dateimetadaten lesen. |
| Disk Space | E174.1 | Expo FileSystem und native Libraries koennen Speicherplatz fuer lokale Dateien pruefen. |

## Permission Strings

Die iOS Permission-Texte in `app.config.ts` sind deutsch:

- Kamera: "Wir benötigen Zugriff auf deine Kamera, um Weinetiketten zu scannen."
- Fotos: "Wir benötigen Zugriff auf deine Fotos, um Weinetiketten zu importieren."

`NSPhotoLibraryAddUsageDescription` wird in Sprint 17 Schritt 1 nicht gesetzt, weil die App aktuell keine Dateien direkt in die iOS-Fotobibliothek schreibt. Datenexport laeuft ueber `expo-sharing`.

## App Store Connect Ableitung

Fuer App Store Connect Privacy Labels sollte Schritt 4/5 diese Angaben uebernehmen:

- Kein Tracking.
- Daten verknuepft mit User: Email Address, User ID.
- Daten nicht verknuepft: Photos or Videos, Crash Data.
- Zweck jeweils App Functionality.

Falls spaeter Analytics, Marketing, Ads oder eine andere Sentry-User-Verknuepfung eingefuehrt werden, muss dieses Audit aktualisiert werden.

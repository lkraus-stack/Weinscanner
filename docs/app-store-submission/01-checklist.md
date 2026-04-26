# App Store Connect Submission Checklist

Letzte Aktualisierung: 2026-04-26

Build-Version: 1.0.0 (Build 1)

Quellen:

- Apple Screenshot Specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Apple Age Ratings: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions

## Pre-Requirements

- [ ] Apple Developer Account aktiv (99 USD/Jahr)
- [ ] Bundle ID `com.francoconsulting.winescanner` registriert in developer.apple.com unter Certificates, Identifiers & Profiles
- [ ] App in App Store Connect angelegt: https://appstoreconnect.apple.com -> My Apps -> +
- [ ] Apple Team ID notiert: developer.apple.com -> Membership
- [ ] ASC App ID notiert: App Store Connect -> My Apps -> Wine Scanner -> App Information
- [x] `eas.json` `submit.production.ios.ascAppId` mit echter ASC App ID aktualisiert: `6763864187`
- [x] `eas.json` `submit.production.ios.appleTeamId` mit echter Apple Team ID aktualisiert: `4Q33M4DTL3`
- [ ] EAS Production Environment Variables gesetzt: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`

## App Information

| Feld | Wert |
| --- | --- |
| App-Name | Wine Scanner |
| Bundle-ID | com.francoconsulting.winescanner |
| SKU | wine-scanner-001 |
| Primary Language | German (Germany) |
| Subtitle | siehe `07-listing-texts.md` |
| Privacy Policy URL | https://www.franco-consulting.com/datenschutz |
| Marketing URL | https://www.franco-consulting.com |
| Support URL | https://www.franco-consulting.com/kontakt |

## Categories

| Feld | Wert |
| --- | --- |
| Primary | Food & Drink |
| Secondary | Lifestyle |

## Pricing and Availability

| Feld | Wert |
| --- | --- |
| Price | Kostenlos |
| Availability | Deutschland, Österreich, Schweiz für Initial Launch |
| In-App Purchases | Keine |
| Subscriptions | Keine |

Spätere Märkte: weitere EU-Länder nach erfolgreicher Beta.

## App Privacy

Die App-Privacy-Section in App Store Connect muss mit dem Privacy Manifest und `02-privacy-audit.md` übereinstimmen.

### Contact Info

Email Address:

- Linked to User: Yes
- Used for Tracking: No
- Purpose: App Functionality

### Identifiers

User ID:

- Linked to User: Yes
- Used for Tracking: No
- Purpose: App Functionality

### User Content

Photos or Videos:

- Linked to User: No
- Used for Tracking: No
- Purpose: App Functionality

### Diagnostics

Crash Data:

- Linked to User: No
- Used for Tracking: No
- Purpose: App Functionality

### Tracking

- App does NOT track users across other companies' apps and websites.
- `NSPrivacyTracking` ist `false`.
- `NSPrivacyTrackingDomains` ist leer.

## Age Rating

Beantworte den Age Rating Questionnaire ehrlich mit folgenden Werten:

- Cartoon or Fantasy Violence: None
- Realistic Violence: None
- Sexual Content or Nudity: None
- Profanity or Crude Humor: None
- Alcohol, Tobacco, or Drug Use or References: Infrequent/Mild
- Mature/Suggestive Themes: None
- Horror/Fear Themes: None
- Medical/Treatment Information: None
- Gambling: None
- Unrestricted Web Access: None
- Contests: None

Erwartung: Bei `Infrequent/Mild Alcohol, Tobacco, or Drug Use or References` ist laut Apple ein Rating im Bereich 12+ möglich. Falls Apple den Wein-Bezug als intensiver einstuft, kann 17+ entstehen. Für Wine Scanner ist 12+ plausibel, aber das finale Rating entscheidet App Store Connect.

## Localization

Phase 1 (Initial Launch):

- German (Germany) - Primary

Phase 2 (nach Beta):

- English (US) optional

## Version Information

### Promotional Text (max 170 Zeichen)

Vorschlag:

"Foto vom Etikett, KI erkennt deinen Wein in Sekunden. Bewerte und sammle deine Lieblingsweine im persönlichen Weinregal."

### Description (max 4000 Zeichen)

Siehe `07-listing-texts.md`.

### Keywords (max 100 Zeichen, kommagetrennt)

Vorschlag:

`Wein,Sommelier,Weinregal,Riesling,Bordeaux,Bewertung,Verkostung,Weinkeller,Vinothek,Etikett`

Vor dem Eintragen in App Store Connect nochmals auf exakt 100 Zeichen inklusive Kommas prüfen.

### What's New in This Version

"Erste Version von Wine Scanner. Foto-basierte Wein-Erkennung mit KI, persönliches Weinregal, Bewertungen und Bestand."

## App Review Information

### Sign-In Required

Yes

### Demo Account

- Email: [Lukas trägt Test-Account ein]
- Password: [bei OTP-Login: Hinweis, dass der Code per E-Mail kommt]

### Notes für Reviewer

"Wine Scanner ermöglicht das Fotografieren von Wein-Etiketten und KI-basierte Erkennung.

Login:

- Tippen Sie eine E-Mail ein und drücken Sie 'Code senden'.
- Sie erhalten einen 6-stelligen Code per E-Mail.
- Geben Sie den Code ein, um sich anzumelden.

Das Test-Konto enthält Beispiel-Scans, Bewertungen und Bestandseinträge.

Die KI-Analyse läuft über DSGVO-konforme Server in der EU (Vantero, EU-Hosting).

Bei Fragen: lukas@franco-consulting.com"

### Contact Information

- First Name: Lukas
- Last Name: [Nachname]
- Phone: [Telefon]
- Email: lukas@franco-consulting.com

## Screenshots

### Required Sizes

Aktueller Apple-Hinweis: App Store Connect nutzt inzwischen neue Display-Klassen wie 6.9" als primäre Screenshot-Größe. 6.7" und 6.1" bleiben für Wine Scanner als geplante Review- und Marketing-Sets relevant. Vor Upload die aktuell angezeigten Pflichtgrößen in App Store Connect prüfen.

- 6.9" iPhone: falls in App Store Connect gefordert, aktuelles Pro-Max-Set zuerst hochladen
- 6.7" iPhone (Pro Max): mindestens 3, maximal 10 Screenshots
- 6.1" iPhone (Standard): mindestens 3, maximal 10 Screenshots

### Recommended Screens

1. Verlauf-Tab mit gefüllten Items (zeigt Sammlung)
2. Wine-Detail-View mit Aromen und Beschreibung
3. Scan-Flow Confirmation-Screen mit Jahrgangs-Picker
4. Bestand-Tab mit Stats-Header
5. Bewerten-Modal mit Sternen

### Optional

- iPad: nicht erforderlich, solange `ios.supportsTablet` auf `false` bleibt
- 5.5" iPhone: laut Apple nur noch relevant, wenn ältere Display-Sets nicht durch größere Screenshots abgedeckt werden

## App Icon

- 1024x1024 PNG
- Kein Alpha-Channel
- Vollflächig
- Keine abgerundeten Ecken, iOS macht das selbst
- Upload direkt in App Store Connect

## Build Upload

Nach erfolgreichem Production Build:

```sh
eas build --profile production --platform ios
```

Submit:

```sh
eas submit --profile production --platform ios --latest
```

Danach:

1. Build erscheint in App Store Connect -> TestFlight nach Verarbeitung.
2. Verarbeitung dauert typischerweise bis zu 30 Minuten, kann aber länger dauern.
3. Build auswählen für Submit to Review.
4. Compliance-Frage "Does your app use encryption?" mit "No" beantworten, weil `usesNonExemptEncryption: false` gesetzt ist.

## Submit for Review

- [ ] Alle App-Information-Felder ausgefüllt
- [ ] Kategorien gesetzt
- [ ] Pricing and Availability gesetzt
- [ ] App Privacy ausgefüllt
- [ ] Age Rating ausgefüllt
- [ ] Build verarbeitet und gewählt
- [ ] Screenshots hochgeladen
- [ ] App Icon hochgeladen
- [ ] Privacy URL erreichbar und app-spezifisch
- [ ] Impressum erreichbar
- [ ] Demo-Account funktional
- [ ] Demo-Daten realistisch
- [ ] Notes für Reviewer aussagekräftig
- [ ] Submit for Review

## Nach Submit

- Apple Review dauert typischerweise 24 bis 72 Stunden.
- Status-Updates in App Store Connect prüfen.
- Bei Reject: Reason analysieren, fixen, neu submitten.
- Bei Approve: manuelles Release oder Auto-Release je nach gewählter App Store Connect Einstellung.

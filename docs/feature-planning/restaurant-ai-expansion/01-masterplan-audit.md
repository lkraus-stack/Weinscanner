# Wine Scanner 2026: Masterplan Audit

Stand: 03. Mai 2026
Status: Gate 0 erstellt, Gate 1 als naechster launchkritischer Umsetzungsschritt.

## Ziel

Dieses Dokument ist der Kontrollpunkt vor AI-Chat, Multi-Source-Restaurantdaten und Launch-Polish. Es verhindert, dass Wine Scanner kurz vor App Store Submission riskante Features, nicht lizenzierte Datenquellen, direkte API-Keys im Mobile-Bundle oder unklare Drittanbieter-KI-Fluesse einbaut.

Stop-Regel: Ein Claim wird nur umgesetzt, wenn er durch offizielle Dokumentation, Vertrag, vorhandenen Repo-Code oder eine explizite Produktentscheidung belegbar ist. Alles andere bleibt Hypothese.

## Repo-Invarianten

- Expo SDK 54, React Native 0.81, New Architecture aktiv.
- `react-native-reanimated` ist aktuell `~4.1.1`; kein Reanimated-3-Downgrade ohne separaten nativen Build-Beweis.
- `@gorhom/bottom-sheet` ist vorhanden und wird nicht durch eine neue UI-Migration ersetzt, solange die TestFlight-Builds stabil bleiben muessen.
- AI-Calls laufen serverseitig ueber Supabase Edge Functions, insbesondere Vantero ueber `supabase/functions/_shared/ai.ts`.
- Mobile-Code darf keine Provider-Secret-Keys enthalten.
- Bestehende Theme-Tokens und Komponenten bleiben Standard. Keine React Native Reusables/NativeWind-Migration vor Submission.
- Restaurant Discovery nutzt Google Places, `analyze-restaurants`, Map/List-View, Filter, gespeicherte Restaurants und bestehende Wine-Indicator-Arbeit.
- Worktree war vor diesem Gate bereits dirty. Bestehende Aenderungen werden nicht zurueckgedreht.

## Verifizierte Fakten

| Bereich | Status | Quelle | Konsequenz |
| --- | --- | --- | --- |
| Apple App Review | Apps muessen Third-party-Services und Datennutzung klar offenlegen. Software, die App-Funktionalitaet erweitert, darf Daten oder Privacy-Permissions nicht ohne explizite Zustimmung erhalten. | Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/ | Vor AI-Funktionen ist ein eigener Consent-Flow Pflicht. |
| TripAdvisor Content API | Offizielle Content API, Billing noetig, 5.000 Calls pro Monat gratis, bis zu 5 Reviews und 5 Photos pro Location, Attribution erforderlich. | Overview: https://tripadvisor-content-api.readme.io/reference/overview, FAQ: https://tripadvisor-content-api.readme.io/reference/faq | Nur nach API-Key, Billing, Attribution-UI, Cache-Policy und Tageslimit integrieren. |
| Foursquare Places API | Ab 01. Juni 2026 nur 500 freie Pro Calls, danach CPM-Tiers. Premium-Endpunkte wie Photos, Tips, Hours sind kostenpflichtig. | https://docs.foursquare.com/developer/reference/upcoming-changes | Nur mit Kill-Switch, Tagesquote, Kostenalarm und Cache. |
| Apple Maps Server API | Offizieller Apple-Provider fuer Maps-Server-Funktionen. | https://developer.apple.com/documentation/applemapsserverapi | Mess-Prototyp hinter Flag, kein Sofort-Ersatz fuer Google Places. |
| Declared Age Range | Apple stellt eine Declared-Age-Range-Technologie bereit. | https://developer.apple.com/documentation/DeclaredAgeRange | Kurzfristig Self-Attestation in App, native Integration als Folgearbeit bei Review- oder Rechtsbedarf. |
| TheFork | B2B-/Partner-API, Credentials ueber Partnerprozess. | https://docs.thefork.io/B2B-API/introduction, https://docs.thefork.io/preliminary-steps | Kein Self-Service-Shortcut fuer Sprint A. |

## Korrigierte Briefing-Claims

- Vercel AI SDK bleibt optionaler Server-Prototyp. Der aktuelle Stack ist Supabase Edge plus Vantero und wird zuerst gehaertet.
- Perplexity, Gemini, TripAdvisor und Foursquare werden nicht in die App eingebaut, bis Providerliste, Consent-Text, Privacy Manifest, Kostenbremse und Vertrag/API-Key passen.
- Yelp wird fuer DACH nicht priorisiert, weil Datenqualitaet und Produktschwerpunkt unsicher sind.
- Falstaff, Gault Millau und Michelin werden nur ueber Lizenz oder Partnervertrag genutzt. Scraping ist keine Produktoption.
- OSM/Overpass ist POI-Lueckenfueller, keine Review-Quelle.
- Trust-Score startet intern als Confidence-Signal, nicht als oeffentliche Marketing-Wahrheit.
- React Native Reusables, NativeWind oder grosse UI-Library-Migrationen sind vor Submission zu riskant.

## Provider-Matrix

| Provider | Launch-Status | Personenbezogene Daten moeglich | Lizenzierbar | Kostenrisiko | Gate |
| --- | --- | --- | --- | --- | --- |
| Supabase | Aktiv | Ja, Account, Profil, Scans, Restaurant-Userdaten | Ja, eigener Backend-Provider | Mittel | Bestehend |
| Vantero | Aktiv fuer AI | Ja, Bild-URLs, Scan-Kontext, Restaurant-Analyse-Kontext | Ja, ueber bestehendes Server-Setup | Mittel | Gate 1 consentpflichtig |
| Google Places/Maps | Aktiv | Ja, Standort/IP/Geraetekontext moeglich | Ja, bestehender Provider | Mittel bis hoch | Bestehend |
| TripAdvisor | Nicht aktiv | Ja, Anfragekontext, ggf. Location-Matching | Ja, Content API | Mittel | Gate 3B |
| Foursquare | Nicht aktiv | Ja, Anfragekontext, Location-Matching | Ja, Places API | Hoch ab 2026-06-01 | Gate 3B/C |
| OpenStreetMap/Overpass | Nicht aktiv | Anfrage kann Standort enthalten | Ja, ODbL beachten | Niedrig, Fair-Use beachten | Gate 3A |
| Falstaff/Gault Millau/Michelin | Nicht aktiv | Abhaengig vom Vertrag | Nur Vertrag/Partner | Unbekannt | Business-Dev |
| Perplexity/Gemini/OpenAI | Nicht aktiv fuer Restaurant-Chat | Ja, Prompts und Kontext | Ja, Providervertrag noetig | Mittel bis hoch | Gate 2+ |

## Selbstkritik-Fragen

- Ist diese Quelle offiziell lizenzierbar oder nur technisch abrufbar?
- Wird personenbezogene Information uebertragen, etwa Standort, Bild-URL, Suchanfrage, Bestand oder Restaurantnotiz?
- Kann der User vor der Uebertragung verstehen, welcher Provider beteiligt ist?
- Kann der User verstehen, warum ein Restaurant empfohlen wird?
- Kann der Provider morgen teurer werden, und gibt es Quote, Cache, Kill-Switch und Fallback?
- Ist das vor App Store Submission noetig oder kann es als Feature-Flag warten?
- Kann eine AI-Antwort Restaurants erfinden, die nicht aus einem Tool-Ergebnis stammen?
- Stimmen App-Text, Datenschutz, Privacy Manifest, Review Notes und echte Netzwerkziele ueberein?

## Gate 1: Launch-Sicherheit

Pflicht-Ausgaben:

- Eigener AI-Consent-Flow vor erster AI-Funktion, nicht als versteckte Klausel in Datenschutztexten.
- Consent nennt aktive Provider exakt: aktuell Vantero fuer KI-Analyse, Google Places/Maps fuer Restaurantdaten und Standortsuche.
- Kurzfristiges Age-Gating per Self-Attestation fuer erwachsene Nutzung.
- Datenschutztext aktualisiert mit AI-Consent, Restaurant-AI und Age-Hinweis.
- Privacy Manifest enthaelt App-Funktionsdaten, die fuer AI und Restaurant Discovery relevant sind.
- `rg` darf keine neuen direkten AI-Provider-Keys im Mobile-Code finden.

Red-Team vor Abschluss:

- Was wuerde Apple wegen Third-party-AI, Alkohol, unklarer Provider oder fehlendem Demo-Zugang rejecten?
- Welche Daten verlassen Supabase/EU?
- Gibt es UI-Pfade, die AI starten, bevor Consent und Age Gate gesetzt sind?
- Stimmen Legal-Text und aktive Providerliste mit dem Code ueberein?

## Gate 2: AI-Chat hinter Feature-Flag

Nicht vor Gate 1 abschliessen.

- `restaurant-chat` als Supabase Edge Function, nicht als Mobile-Provider-Call.
- Router-Tools: `search_restaurants`, `get_my_cellar`, `get_restaurant_detail`, spaeter `fetch_multisource_signals`.
- Restaurant-Cards nur, wenn `providerPlaceId` oder gespeicherte `restaurant.id` aus Tool-Ergebnissen stammt.
- Persistenz minimal: Threads, Messages, Consents, Daily Usage. Keine dauerhafte Rohreview-Halde.
- Chat-Einstieg im Discover-Tab hinter Feature-Flag, kein neuer Tab vor Launch.

## Gate 3: Multi-Source-Restaurantdaten

- Sprint A: Google bleibt Primaerquelle, OSM/Overpass nur fuer POI-Luecken in Weinregionen.
- Sprint B: TripAdvisor nur mit Key, Billing, Attribution, Cache-Policy und Tageslimit.
- Sprint B/C: Foursquare nur mit Quote, Kostenalarm und Kill-Switch.
- Falstaff, Gault Millau, Michelin nur per Vertrag.
- Trust-Score intern erklaeren ueber Quellenanzahl, Aktualitaet, Cross-Source-Konsistenz und Review-Volumen.

## Gate 4: UX-Polish

- Bestehendes Theme und bestehende UI-Komponenten verbessern.
- Skeletons, `expo-image`, Source-Chips, Wine-Highlights und klare Empty/Error-States inkrementell.
- Bottom-Sheet- oder Map-Architektur nicht kurz vor Submission neu bauen.
- Apple Maps nur als Vergleichsprototyp hinter Flag.

## Verifikations-Checkliste

- `npx tsc --noEmit`
- `npx expo lint`
- relevante `npm run test:*`
- `rg "#[A-Fa-f0-9]{6}" app src components lib hooks supabase`
- `rg "\\x{2014}|\\x{2013}" app src components lib hooks supabase`
- Red-Team-Pass gegen App Review, Kosten, Halluzination, Datenabfluss und UX-Fallen.

## Entscheidung

Naechster umsetzbarer Schritt ist Gate 1. Neue Restaurant-Datenquellen, Chat-Router und UI-Stack-Aenderungen bleiben blockiert, bis Consent, Age Gate, Legal-Texte und Provider-Wahrheit sauber sind.

# Restaurant-Discovery: App-Analyse

Stand: 2026-05-01

## Kurzfazit

Wine Scanner hat bereits eine gute technische Grundlage für ein Restaurant-Discovery-Feature: Auth, userbezogene Daten, Supabase Edge Functions, Caching, RLS, Dark Mode und Offline-Hinweise sind vorhanden. Das Feature sollte diese Stärken nutzen und nicht versuchen, Google Maps oder Tripadvisor komplett nachzubauen.

Die beste strategische Richtung ist: Wine Scanner hilft Nutzern, Restaurants zu finden, die zu ihrem Weinprofil und Genussstil passen. Der erste Release darf noch einfach sein, aber die Architektur muss von Anfang an Datenschutz, API-Kosten und Caching sauber behandeln.

## 1. Bestehende Architektur

### App-Struktur

Aktuelle Hauptnavigation:

| Tab | Rolle heute | Relevanz für Restaurant-Discovery |
| --- | --- | --- |
| Verlauf | Gespeicherte Scans und Drafts | Grundlage für Vorlieben, häufige Regionen, Farben und Rebsorten |
| Bestand | Eigene Flaschen | Signal für Weinstil und Preisniveau |
| Scan | Hauptfeature | Kann später Restaurant-Weinkarten oder Wein im Restaurant verbinden |
| Bewertet | Persönliche Bewertungen | Stärkstes Signal für Geschmack |
| Profil | Konto, Theme, Export, Legal | Ort für Datenschutz, Standort-Freigabe und Präferenzen |

Für Restaurant-Discovery ist ein eigener Tab `Entdecken` sinnvoller als eine versteckte Profile-Funktion. Es ist ein wiederkehrender Use Case und braucht Platz für Karte, Liste, Filter, Standort und später gespeicherte Orte. Lukas hat entschieden, dass die Karte im MVP Pflicht ist, weil Restaurant-Suche ohne visuelle Geo-Referenz unvollständig wirkt.

### Datenmodell heute

Globale Tabellen:

| Tabelle | Inhalt | Datenschutz-Relevanz |
| --- | --- | --- |
| `wines` | Produzent, Weinname, Region, Land, Farbe, Rebsorte | Globaler Cache, keine Userdaten |
| `vintages` | Jahrgangsdaten, Preis, Aromen, Beschreibung, Pairing | Globaler Cache, keine Userdaten |

Userbezogene Tabellen:

| Tabelle | Inhalt | Restaurant-Relevanz |
| --- | --- | --- |
| `profiles` | Name, Avatar, Preferences, Onboarding | Später Präferenzen wie Küche, Budget, Radius |
| `scans` | User, Vintage, Bilder, Standortfelder, Datum | Zeigt, was Nutzer tatsächlich entdecken |
| `ratings` | Sterne, Notiz, Anlass, Trinkdatum | Wichtigstes Matching-Signal |
| `inventory_items` | Bestand, Menge, Lagerort, Kaufpreis | Signal für Preisniveau und Weinstil |
| `ai_feedback` | Korrekturen an KI-Ergebnissen | Qualitätssicherung, aber nicht direkt für Restaurant |

Die Spalte `scan_location_lat/lng/name` existiert bereits in `scans`, wird aber aktuell nicht als Restaurant- oder Standortfeature genutzt. Das ist ein kleiner Vorteil, weil das Datenmodell schon grundsätzlich Standortdaten kennt.

### Edge-Function-Pattern

Bestehende Regeln:

- Externe KI-Calls laufen nie direkt aus der App.
- Secrets bleiben in Supabase Secrets.
- User wird in Edge Functions über `requireUser(req)` geprüft.
- Service-Role wird nur in Edge Functions genutzt.
- Multi-Table-Operationen laufen über RPCs.

Für Restaurant-APIs ist das perfekt: Google, Foursquare, Yelp oder Partner-APIs dürfen nicht aus der mobilen App direkt aufgerufen werden. Alle API-Keys gehören in Edge Functions.

### Storage-Pattern

Heute:

- Labelbilder liegen in Supabase Storage.
- Userpfade sind user-scoped.
- Anzeige läuft über Signed URLs.
- Bildanzeige nutzt `expo-image` mit Cache.

Für Restaurants brauchen wir vermutlich keine eigenen hochgeladenen Bilder im MVP. Externe Restaurantfotos sollten nicht dauerhaft kopiert werden, solange die API-Bedingungen das nicht ausdrücklich erlauben. Besser: Foto-Referenzen cachen und Bilder über den Provider abrufen oder nur temporär anzeigen.

### Theme und UI

Heute:

- Vollständiges Light/Dark/Auto-Theme.
- Farben über `useTheme()`.
- Keine Inline-Hex-Farben.
- Deutsche UI-Texte.
- Listen mit FlashList ab 50+ Items.

Restaurant-Discovery muss diese Regeln übernehmen. Besonders wichtig: Karten, Filterchips und Restaurantkarten müssen im Dark Mode genauso sauber sein wie die bestehenden Weinlisten.

## 2. User-Daten-Inventar für Matching

### Starke Signale

| Signal | Quelle | Nutzbarkeit |
| --- | --- | --- |
| Hohe Bewertungen | `ratings.stars`, `notes`, `occasion` | Zeigt, welche Weinstile Nutzer wirklich mögen |
| Wiederholte Scans | `scans.scanned_at`, verknüpfter Wein | Zeigt Interesse an Regionen, Produzenten, Farben |
| Bestand | `inventory_items.quantity`, Kaufpreis | Zeigt Kaufverhalten und Preisniveau |
| Aromen und Pairings | `vintages.aromas`, `food_pairing` | Grundlage für einfache Genussprofile |
| Korrekturen | `ai_feedback` | Zeigt Datenqualität, nicht primär Empfehlung |

### Schwache oder fehlende Signale

| Lücke | Warum relevant |
| --- | --- |
| Kein aktives Restaurantprofil | Nutzer haben noch keine Küchen-, Budget- oder Distanzpräferenzen |
| Kein Standort-Consent | Ohne Standort nur manuelle Stadt- oder PLZ-Suche |
| Keine Restaurantbesuche | App weiß noch nicht, welche Orte Nutzer mögen |
| Keine Freundesdaten | Keine sozialen Empfehlungen |
| Keine Weinkarten-Daten | Wein-Matching bleibt am Anfang eher indirekt |

### Empfehlung

Im MVP nicht direkt mit komplexer KI-Personalisierung starten. Erst Daten sammeln:

- Welche Restaurants öffnet der Nutzer?
- Welche speichert er?
- Welche bewertet er nach Besuch?
- Welche Küche und Preisklasse filtert er?

Danach kann das Weinprofil echte Relevanz bekommen.

## 3. Stärken, die das Feature verstärken sollte

### Datenqualität statt blindem Vertrauen

Wine Scanner erzwingt heute beim Wein den Jahrgang als bewusste Nutzerbestätigung. Diese Haltung passt auch für Restaurants:

- Externe Bewertungen nicht als absolute Wahrheit verkaufen.
- Eigene Wine-Scanner-Bewertung danebenstellen.
- Restaurantdaten als "Quelle: Google" oder "Quelle: Foursquare" transparent markieren.
- Bei alten Daten einen Frischehinweis zeigen.

### Caching und Kostenkontrolle

Die App nutzt bereits globale Wein-Stammdaten als Cache. Für Restaurants sollte dasselbe gelten:

- Provider-Ort wird einmal geladen.
- Stammdaten werden in `restaurants` gecacht.
- Suchergebnisse werden geobasiert gecacht.
- Details und Öffnungszeiten werden getrennt aktualisiert.

Das reduziert Kosten und macht die App schneller.

### DSGVO-Haltung

Heute ist Wine Scanner sauber user-scoped und EU-orientiert. Bei Restaurant-Discovery kommen Standortdaten dazu, also muss das Feature besonders klar sein:

- Standort nur "Beim Verwenden der App".
- Manuelle Stadt-Suche als gleichwertige Alternative.
- Kein permanentes Tracking.
- Kein Verlauf von Rohkoordinaten ohne klaren Nutzen.
- Privacy Policy vor App-Store-Update erweitern.

### Dark Mode und hochwertiges UI

Restaurant-Discovery ist visuell. Die vorhandene Theme-Basis ist ein Vorteil, weil ein guter Restaurant-Tab direkt hochwertig wirken kann:

- Fotos groß, aber nicht marketingartig.
- Karten sparsam und funktional.
- Filter leicht erreichbar.
- Distanz, Bewertung, Küche und Öffnungsstatus schnell scanbar.

## 4. Schwächen und Lücken

| Bereich | Lücke | Empfehlung |
| --- | --- | --- |
| Standort | Keine Location-Permission im Config | `NSLocationWhenInUseUsageDescription` ergänzen, erst wenn Feature gebaut wird |
| Privacy Manifest | Location noch nicht deklariert | Vor Release von Restaurant-Feature aktualisieren |
| API-Keys | Neue Provider-Secrets fehlen | Nur Supabase Edge Function Secrets |
| Karten | Keine Map-Komponente installiert | MVP braucht `react-native-maps` mit Google Maps Provider |
| Datenmodell | Keine Restauranttabellen | Cache- und User-Restaurant-Tabellen planen |
| Business | Kein API-Kostenmodell | Quotas, Caching, Feature Flag und monatliches Budget |
| Tests | Keine Geo/API Tests | Edge Function Tests für Search, Details, Cache |

## 5. Architektur-Fit

Restaurant-Discovery passt gut zu Wine Scanner, wenn es als Genuss-Feature gedacht wird:

- Nicht "finde irgendein Restaurant".
- Sondern "finde ein Restaurant, bei dem Essen, Wein und Stil zu dir passen".

Es passt schlecht, wenn es als generischer Google-Maps-Klon gebaut wird. Dafür fehlen eigene Daten, Budget und Differenzierung.

## 6. Konsequenz für die Planung

Der erste Restaurant-Sprint sollte mit Karten-Foundation starten, aber ohne KI-Matching oder Reservierungslogik. Die sinnvolle Reihenfolge ist:

1. Standort- und Stadt-Suche sauber planen.
2. Google Maps im `Entdecken` Tab integrieren.
3. Restaurantdaten über Edge Functions laden und auf Karte plus Liste darstellen.
4. Restaurants speichern und später bewerten lassen.
5. Erst danach Weinprofil, Matching und Reservierung ausbauen.

## Quellen und interne Bezugspunkte

- `AGENTS.md`: Architekturregeln, Edge-Function-Konventionen, Theme-Regeln.
- `docs/perf-audit/03-improvements.md`: Listen- und Cache-Konventionen.
- `app.config.ts`: aktuell Kamera/Fotos, aber noch keine Location-Permission.
- `supabase/migrations/20260425000200_wines_vintages.sql`: globale Wein- und Vintage-Tabellen.
- `supabase/migrations/20260425000300_user_data.sql`: Profile, Scans, Ratings, Inventory.
- `supabase/functions/_shared/http.ts`: Edge-Function-Auth und Client-Pattern.

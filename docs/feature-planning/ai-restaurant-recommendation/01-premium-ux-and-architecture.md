# KI-Restaurant-Empfehlung: Premium-UX und Architektur

## Zielbild

Die KI-Empfehlung soll sich nicht wie eine normale Ergebnisliste anfühlen, sondern wie ein kuratierter Restaurant-Concierge. Der Nutzer hat bereits eine Karte oder Liste mit echten Google Places Daten. Die KI verdichtet daraus eine kleine Top-Auswahl mit klarer Begründung, ehrlichen Risiken und Wine-Scanner-Kontext.

Das MVP ist bewusst kein Chat. Der Nutzer wählt einen Anlass, die App analysiert passende Kandidaten und zeigt eine bildgeführte Auswahl. Ziel ist eine schnelle Entscheidung mit einem hochwertigen Erlebnis.

## MVP-Scope

- Einstieg im Orte-Tab über `KI-Empfehlung`, sobald echte Google-Restaurantdaten vorliegen.
- Anlass-Auswahl im Bottom Sheet:
  - Schnelles Essen
  - Schöner Abend
  - Besonderes Erlebnis
  - Weinfokus
  - Reise
- Analyse-State mit Kandidatenbildern und menschlichen Statuszeilen.
- Ergebnis-Screen `KI-Auswahl` mit Top-3:
  - Beste Wahl
  - Beste Wein-Option
  - Sichere Wahl oder dynamisches Label aus erlaubter Liste
- Direkte Aktionen pro Empfehlung:
  - Details
  - Merken
  - Route
- Restaurant-Detail mit Sektion `KI-Einschätzung`.

## UX-Regeln

- Fotos führen die Empfehlung. Text erklärt nur knapp, warum die Auswahl sinnvoll ist.
- Score sichtbar und schnell lesbar, aber nicht als absolute Wahrheit inszenieren.
- Confidence wird offen gezeigt:
  - Hohe Sicherheit
  - Solide Empfehlung
  - Mit Vorsicht
- Jede Empfehlung nennt Stärken und mögliche Warnhinweise.
- Keine langen KI-Textblöcke auf der Ergebnisliste.
- Keine generischen Platzhalter, wenn Google-Fotos vorhanden sind.
- Fallback ohne Foto ist ein hochwertiger Cuisine-Fallback.
- Light und Dark Mode müssen gleich hochwertig wirken.

## Datenbasis

Google Places liefert je Place Details Call nur begrenzte Review-Daten. Die Empfehlung wird deshalb als evidenzbasierte Kuratierung gebaut, nicht als vollständige Analyse aller öffentlichen Bewertungen.

Genutzte Signale:

- Google Rating
- Anzahl Google Bewertungen
- bis zu 5 Google Review-Auszüge
- Review Summary, falls verfügbar
- Öffnungsstatus
- Küchenrichtung und Place Types
- Preisniveau
- Entfernung
- Wine-Scanner Restaurantbewertung des Nutzers
- passende Weine aus dem Bestand

Rohreviews werden nicht dauerhaft gespeichert. Persistiert werden nur abgeleitete Signale, Scores und Begründungen.

## Architektur

Neue Tabellen:

- `restaurant_ai_analyses`
  - gecachte Analyse pro Nutzer, Restaurant, Anlass und Analyseversion
  - TTL: 24 Stunden
- `restaurant_recommendation_runs`
  - user-scoped KI-Run mit Kontext, Kandidaten und Top-3 Ergebnis
  - TTL: 12 Stunden

Neue Edge Function:

- `analyze-restaurants`
  - nimmt Anlass, Kontext, Filter und bis zu 8 Restaurant-Kandidaten entgegen
  - reduziert serverseitig auf maximal 5 Restaurants
  - lädt Google Details und Review-Signale
  - ruft Vantero einmal für alle Kandidaten auf
  - validiert und normalisiert das Ergebnis
  - speichert Run und Einzelanalysen

Client:

- `useAnalyzeRestaurants`
- `useRestaurantRecommendationRun`
- `useLatestRestaurantAiRecommendation`

## Sicherheitsnetz

Vantero kann formal ungültiges JSON liefern. Die Function bricht dann nicht mit 500 ab, sondern erzeugt eine konservative kuratierte Auswahl aus Google-Signalen. Dadurch bleibt der Nutzerflow stabil. Fehlende Vantero-Konfiguration wird nicht maskiert, sondern weiterhin als Konfigurationsfehler behandelt.

## Kostenkontrolle

- Analyse nur nach Button-Tap.
- Maximal 5 Runs pro User und Tag.
- Maximal 5 Restaurants pro Run mit Details und Reviews.
- Run-Cache 12 Stunden.
- Restaurant-Analyse-Cache 24 Stunden.
- Keine dauerhafte Speicherung von Rohreviews.

## Launch-Test

Automatisch:

- `npx tsc --noEmit`
- `npx expo lint`
- `npx expo-doctor`
- `npm run test:restaurants`
- `npm run test:ai-restaurants`

Manuell auf TestFlight:

- Augsburg mit `Schöner Abend`
- München mit `Weinfokus`
- Empfehlung öffnen, Beste Wahl prüfen
- Details aus Empfehlung öffnen
- Merken aus Empfehlung testen
- Route aus Empfehlung testen
- Detailseite mit und ohne vorhandene KI-Analyse testen
- Light und Dark Mode prüfen

## Spätere Erweiterungen

- Multi-Source-Analyse mit Falstaff, Michelin oder TripAdvisor, falls rechtlich und API-seitig möglich.
- KI-Ranking nach konkretem Wein im Bestand.
- Reiseplanung mit mehreren Restaurants.
- Öffentliche Wine-Scanner Community-Signale.
- Premium-Limits und bessere Pro-User Kontingente.

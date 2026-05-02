# Restaurant-Discovery: Finale Empfehlung und Roadmap

Stand: 2026-05-01

## Empfehlung in einem Satz

Baue nach dem App-Store-Launch ein `Entdecken` MVP mit Google Maps, Google Places, Supabase Cache, optionalem Standort und klarer Wein-/Genusspositionierung. Karte und Liste sind beide im MVP. Keine In-App-Reservierung und kein KI-Matching im ersten Schritt.

## Warum dieser Pfad

Wine Scanner gewinnt nicht, indem es Google Maps kopiert. Wine Scanner gewinnt, wenn es Nutzern weniger, bessere und genussrelevantere Restaurantoptionen gibt.

Der MVP sollte das Kernproblem lösen:

- "Ich finde schnell ein gutes Restaurant."
- "Ich sehe sofort auf der Karte, wo die Restaurants liegen."
- "Ich sehe Bewertungen, Distanz, Fotos, Öffnungszeiten und Preisniveau."
- "Ich kann es speichern."
- "Ich kann extern navigieren oder reservieren."

Alles Weitere entsteht aus echten Nutzungsdaten.

## Empfohlene API-Strategie

### Primär

Google Places API.

Warum:

- Beste DACH-Abdeckung.
- Gute Bewertungen und Öffnungszeiten.
- Höchste Chance, dass Testnutzer sofort brauchbare Ergebnisse sehen.

### Sekundär

Foursquare Places API als Vergleich und möglicher Kostenfallback.

Warum:

- Klare self-service Preisstruktur.
- Günstiger bei Pro-Endpunkten.
- Gute POI-Daten, aber DACH-Qualität muss getestet werden.

### Später

Quandoo/OpenTable/TheFork für Reservierungslinks oder echte Verfügbarkeit.

### Nicht im MVP

Falstaff, Michelin und Gault&Millau als Datenquelle, außer über offizielle Lizenz oder Link-Out.

## Roadmap

### Vorbedingung: App-Store-Launch abschließen

Restaurant-Discovery sollte nicht vor der ersten stabilen App-Store-Version umgesetzt werden. Erst muss der Kern, also Scan, Verlauf, Bestand, Auth und TestFlight, stabil sein.

### Sprint 21: Foundation

Ziel: Technische Grundlage für Tab, Standort, Stadt-Suche und Datenschutz.

Aufgaben:

- Entscheidung `Entdecken` Tab finalisieren.
- Location-Permission-Konzept festlegen.
- Datenschutztext und App Store Privacy vorbereiten.
- Datenmodell für `restaurants`, `saved_restaurants`, `restaurant_search_cache` planen.
- Edge Function Skeleton für `search-restaurants`.
- Feature Flag für Restaurant-Tab.
- Default-Location ohne Permission: München-Stadtmitte.

Erfolg:

- Tab ist hinter Flag technisch vorbereitet.
- Kein API-Key im Bundle.
- RLS-Konzept steht.

### Sprint 22: Map und Liste

Ziel: Google Maps Provider integrieren und UI zwischen Karte und Liste umschaltbar machen.

Aufgaben:

- `react-native-maps` einplanen und konfigurieren.
- Google Maps iOS API-Key mit Bundle-ID Restriktion.
- `PROVIDER_GOOGLE` nutzen.
- Kartenansicht und Listenansicht parallel.
- Prominenter Toggle `Karte` und `Liste`.
- Platzhaltermarker und Empty States.

Erfolg:

- Karte lädt auf iPhone flüssig.
- Liste und Karte teilen denselben UI-State.
- Standort verweigert führt sauber zur Stadt-Suche.

### Sprint 23: Restaurant-Daten

Ziel: Erste echte Restaurantdaten aus Google Places auf Karte und Liste.

Aufgaben:

- Google Places Key als Supabase Secret.
- `search-restaurants` Edge Function.
- Field Masks bewusst definieren.
- Restaurant-Mapping normalisieren.
- Marker auf Karte rendern.
- Restaurantkarten in Liste rendern.
- Cache schreiben und lesen.
- Budget- und Rate-Limit-Handling.
- Teststädte vergleichen.

Erfolg:

- München, Wien, Zürich, Berlin liefern brauchbare Ergebnisse.
- Cache-Hit funktioniert.
- Providerfehler werden sauber angezeigt.

### Sprint 24: Detail-View und Filter

Ziel: MVP funktional komplett machen.

Aufgaben:

- Restaurant-Detail bei Tap auf Marker oder List Item.
- Filter für Distanz, Bewertung, Küche, aktuell offen.
- Externer Link zu Google Maps für Navigation.
- Externer Link zu Website oder Reservierungsplattform.
- Restaurant speichern.
- Dark Mode und kleine iPhones.

Erfolg:

- Nutzer kann aus Karte oder Liste ins Detail.
- Nutzer kann ein Restaurant in unter 60 Sekunden auswählen.
- Keine abgeschnittenen Texte auf kleinem iPhone.

### Sprint 25: Polish und TestFlight

Ziel: Release-ready MVP.

Aufgaben:

- TestFlight mit 5 bis 10 echten Nutzern.
- API-Kosten beobachten.
- Cache-Hit-Rate messen.
- Marker-Clustering ab 20 sichtbaren Markern.
- Offline-Behavior.
- Error States.
- Privacy Policy finalisieren.
- App Store Connect Datenschutz aktualisieren.
- UX-Feinschliff.

Erfolg:

- Keine Launch-Blocker.
- Monatskosten unter Budget.
- Lukas kann in echten Situationen Restaurants finden.

### Sprint 26: App Store Update

Ziel: Restaurant-Discovery öffentlich releasen.

Aufgaben:

- Build und Submit.
- Release Notes.
- Screenshots mit `Entdecken`.
- Monitoring in Sentry und Supabase.
- Feedback sammeln.

Erfolg:

- Feature live.
- Erste Nutzungsdaten.
- Entscheidung für Erweiterung möglich.

## Erweiterung nach MVP

Wenn die Nutzung stimmt, nächster Ausbau:

1. Restaurant-Besuche erfassen.
2. Eigene Restaurantbewertung mit Wein-Score.
3. Wein-Scan mit Restaurantbesuch verknüpfen.
4. Erweiterte Kartenfeatures wie gespeicherte Routen oder Weinorte.
5. Custom Map Style.
6. Reservierungslinks und Partnerprogramme.
7. Weinprofil-Matching.

## Abhängigkeiten vor Implementierung

| Abhängigkeit | Owner | Status |
| --- | --- | --- |
| App Store Launch der Kern-App | Lukas/Codex | Vor Restaurant-Feature |
| Google Cloud Billing und API-Key | Lukas | Offen |
| Monatliches API-Budget | Lukas | Offen |
| Datenschutz-Update | Lukas/Codex | Offen |
| Teststädte definieren | Lukas | Offen |
| Entscheidung Default-View Karte/Liste | Lukas/Codex | Empfehlung: Karte zuerst nach Standort/Stadt |

## Metriken für Erfolg

### Produktmetriken

| Metrik | Ziel im MVP |
| --- | ---: |
| Nutzer öffnen `Entdecken` | 30 Prozent der aktiven Tester |
| Search zu Detail-Open | über 25 Prozent |
| Restaurant gespeichert | über 10 Prozent der Search Sessions |
| Standort-Permission akzeptiert | über 50 Prozent, aber nicht kritisch |
| Wiederkehr in 7 Tagen | beobachten |

### Qualitätsmetriken

| Metrik | Ziel |
| --- | ---: |
| Cached Search Latency | unter 500 ms |
| Cold Search Latency | unter 2,5 s |
| Provider Error Rate | unter 2 Prozent |
| Cache-Hit-Rate nach 2 Wochen | über 30 Prozent |
| Monatliche API-Kosten | unter Budget |

### Business-Metriken später

- Reservierungs-Klicks.
- Affiliate-Umsatz.
- Premium-Konversion.
- Gespeicherte Restaurantlisten.
- Besuchsbewertungen pro Monat.

## Klare Entscheidung

Empfohlen:

- Ja zum Restaurant-Feature.
- Ja zum eigenen Tab.
- Ja zu Google Maps im MVP.
- Ja zu Google Places im MVP.
- Ja zu Edge Functions und Supabase Cache.
- Nein zu In-App-Reservierung im MVP.
- Nein zu Premium-Guides ohne Lizenz.
- Nein zu KI-Matching, bis echte Restaurant- und Userdaten vorhanden sind.

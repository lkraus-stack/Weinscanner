# Restaurant-Discovery: Scope-Optionen

Stand: 2026-05-01

## Entscheidungsvorlage

Es gibt drei sinnvolle Ausbauvarianten. Für direkt nach dem App-Store-Launch empfehle ich klar den MVP, aber mit einer weinfreundlichen Positionierung. Kein generischer Maps-Klon, sondern: "Gute Restaurants in deiner Nähe, mit Fokus auf Genuss und Wein."

## Option 1: MVP in 5 bis 6 Wochen

### Ziel

Der Nutzer kann schnell gute Restaurants in der Nähe oder in einer Stadt auf einer Karte sehen, zwischen Karte und Liste wechseln, Details öffnen, Restaurants speichern und extern navigieren oder reservieren.

### Feature-Scope

| Feature | Beschreibung |
| --- | --- |
| Neuer Tab `Entdecken` | Eigener Einstieg für Restaurant-Suche |
| Standort oder Stadt | Standort erlauben oder manuell Stadt/Adresse eingeben |
| Google Map | Zentrale Kartenansicht mit Restaurant-Markern |
| Karte/Liste Toggle | User kann zwischen Karte und Liste wechseln |
| Restaurant-Marker | Marker zeigen Ort, Bewertung/Farbe und bei Tap Mini-Info |
| Marker zu Detail | Tap auf Mini-Info öffnet Restaurant-Detail |
| Restaurant-Liste | Gleiche Ergebnisse als scanbare Liste mit Foto, Name, Bewertung, Distanz, Küche, Preisniveau |
| Filter | Jetzt offen, Distanz, Preis, Küche, Bewertung |
| Detailseite | Fotos, Adresse, Öffnungszeiten, Bewertung, Website, Telefon, Maps-Link |
| Speichern | Restaurant merken |
| Externe Navigation | Apple Maps oder Google Maps Link |
| Externe Reservierung | Link zu Website, Google, OpenTable/Quandoo falls vorhanden |
| Cache | Restaurantdaten in Supabase cachen |

### Nicht im MVP

- In-App-Reservierung.
- Eigene Restaurantbewertungen.
- Wein-zu-Restaurant-KI-Matching.
- Community.
- Premium-Guides wie Falstaff/Michelin.
- Weinkartenanalyse.
- Custom Map Styling als Pflicht. Es ist möglich, aber kein Launch-Blocker.
- Komplexe Cluster-Animationen für jede Zoomstufe. Ein pragmatischer Cluster-Start reicht.

### Warum diese Grenze gut ist

Das MVP löst bereits Lukas Kernproblem: "Wir finden schwer ein gutes Restaurant." Es bleibt technisch kontrollierbar und produziert erste Nutzungsdaten, ohne sofort komplexe Partnerschaften oder KI zu brauchen.

### Erfolgskriterien

- Nutzer findet in unter einer Minute ein brauchbares Restaurant.
- Nutzer versteht auf der Karte sofort, wo die Optionen liegen.
- API-Kosten bleiben unter einem definierten Monatslimit.
- Standort-Verweigerung blockiert das Feature nicht.
- DACH-Teststädte liefern gute Ergebnisse.
- TestFlight-Nutzer speichern Restaurants.

### Risiken

| Risiko | Gegenmaßnahme |
| --- | --- |
| Zu generisch | Weinfreundliche Filter und späterer Ausbau klar vorbereiten |
| Google-Kosten | Cache, Quotas, Details lazy laden, Map-Bewegungen debouncen |
| Schlechte Daten in ländlichen Regionen | Stadt-Suche und Provider-Vergleich |
| Karte ruckelt | Clustering ab 20 sichtbaren Markern, Viewport-Rendering |
| App wird zu breit | Tab visuell klar als Genuss-Entdeckung positionieren |

## Option 2: Erweiterung in 4 bis 6 Wochen nach MVP

### Ziel

Wine Scanner wird vom Restaurant-Finder zu einem persönlichen Genuss-Logbuch.

### Feature-Scope

| Feature | Beschreibung |
| --- | --- |
| Restaurant-Bewertungen | Eigene Bewertung für Essen, Wein, Service, Ambiente |
| Restaurant-Besuche | "Ich war hier" mit Datum, Anlass und Notiz |
| Wein-Verknüpfung | Scan oder Bewertung mit Restaurantbesuch verknüpfen |
| Weinfreundliche Tags | Weinbar, Sommelier, regionale Weine, Fine Dining |
| Saved Places | Merklisten für Reise oder Stadt |
| Personalisierung Light | Vorschläge basierend auf gespeicherten Restaurants und Weinratings |

### Was diese Stufe differenziert

Hier entsteht der eigentliche Wine-Scanner-Vorteil:

- Nutzer erinnern sich nicht nur an Weine, sondern an Orte.
- Gute Restaurants werden persönlicher.
- Das Weinprofil beginnt echten Einfluss zu bekommen.

### Erfolgskriterien

- Nutzer verknüpfen Scans mit Restaurantbesuchen.
- Gespeicherte Restaurants werden wieder geöffnet.
- Restaurantbewertungen entstehen aus echten Besuchen.
- Der Tab wird nicht nur einmal getestet, sondern wiederholt genutzt.

### Risiken

| Risiko | Gegenmaßnahme |
| --- | --- |
| Zu viele Eingabefelder | Besuch nachträglich und minimal erfassen |
| Nutzer bewerten nicht | Bewertung als kurze 4-Score-Aktion bauen |
| Datenmodell wird komplex | User-Tabellen sauber getrennt von Provider-Cache |

## Option 3: Vollausbau in 3 bis 6 Monaten

### Ziel

Wine Scanner wird zur Wein-Erlebnis-App: Restaurants, Weingüter, Reisen, Reservierungen und persönliche Empfehlungen.

### Feature-Scope

| Feature | Beschreibung |
| --- | --- |
| KI-Matching | "Passt zu deinem Weinprofil" |
| Weinkarten-Erkennung | Menü/Weinkarte scannen und passende Weine erklären |
| In-App-Reservierung | Über Quandoo, OpenTable oder TheFork |
| Premium-Guides | Falstaff, Michelin, Gault&Millau, falls lizenziert |
| Weinreise-Planung | Orte, Restaurants und Weingüter in einer Route |
| Social Layer | Empfehlungen von Freunden oder Community |
| Affiliate | Trackbare Reservierungs- oder Partnerlinks |

### Chancen

- Starke Differenzierung.
- Mehr Nutzungsmomente als nur Wein scannen.
- Mögliche Monetarisierung über Premium und Affiliate.

### Risiken

- Hohe Komplexität.
- API- und Lizenzkosten.
- Verwässerung der App-Identität.
- Viel App-Store- und Datenschutzarbeit.

## Empfehlung

Direkt nach dem App-Store-Launch sollte Wine Scanner mit Option 1 starten, jetzt ausdrücklich mit Karte im MVP.

Aber der MVP sollte bewusst so gestaltet sein, dass Option 2 nahtlos anschließen kann:

- Restaurants werden schon als eigene Entität gecacht.
- Nutzer können Restaurants speichern.
- Detailseite ist so gebaut, dass später "Besuch erfassen" ergänzt werden kann.
- Datenmodell trennt Providerdaten und Userdaten.
- UI spricht bereits von Genuss und Wein, nicht nur "Places".
- Karte und Liste greifen auf dieselben normalisierten Restaurantdaten zu.

## Empfohlener MVP-Zuschnitt

### Muss rein

- `Entdecken` Tab.
- Manuelle Stadt-Suche.
- Optional Standortfreigabe.
- Google Maps Karte.
- Liste mit Restaurants.
- Prominenter Toggle zwischen Karte und Liste.
- Marker mit Mini-Info.
- Detailseite.
- Restaurant speichern.
- Externe Navigation.
- Google Places als Provider.
- Supabase Cache.
- Budgetlimit.
- Privacy-Update.

### Sollte rein

- Filter "Jetzt offen", "Bewertung", "Distanz".
- Provider-Quelle anzeigen.
- Fallback, wenn Standort abgelehnt wird.
- Loading, Empty und Error States.
- Clustering ab 20 sichtbaren Markern.
- Standard Google Maps Style zum Start.

### Kann später

- Eigene Restaurantbewertung.
- Reservierungsintegration.
- Weinprofil-Matching.
- Falstaff/Michelin/Gault&Millau.
- Custom Google Maps Style passend zur Wine-Scanner-Brand.
- Eigene Marker-Illustrationen, wenn Standardmarker im Test zu generisch wirken.

## Default-View Empfehlung

Da Lukas die Karte als Pflicht gesetzt hat und Restaurant-Apps visuelle Geo-Referenz erwarten, empfehle ich:

- Nach Standortfreigabe oder Stadt-Auswahl: Karte zuerst.
- Ohne Standort und ohne gewählte Stadt: Such-/Startscreen zuerst, danach Karte.
- Toggle oben prominent als segmentierte Kontrolle: `Karte` und `Liste`.

Damit fühlt sich das Feature wie eine echte Restaurant-App an, bleibt aber für schnelle Vergleiche listenfähig.

## UX-Positionierung

Der Tab sollte nicht heißen "Restaurants" wie ein Branchenbuch. Besser:

- `Entdecken`
- Untertitel: "Restaurants und Weinorte"
- Leerer Zustand: "Finde Orte, an denen Essen und Wein zusammenpassen."

Das hält die App-Identität zusammen.

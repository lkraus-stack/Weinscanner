# Restaurant-Discovery: Risiken und offene Fragen

Stand: 2026-05-01

## Kurzfazit

Das größte Risiko ist nicht die Implementierung, sondern die Produktpositionierung. Wenn Wine Scanner nur ein zweites Google Maps baut, ist das Feature austauschbar. Wenn es aber "Restaurant-Entdeckung für Wein- und Genussmenschen" wird, kann es die App deutlich stärker machen.

Technisch sind API-Kosten, Datenschutz und Provider-Abhängigkeit die wichtigsten Risiken.

## 1. Technische Risiken

| Risiko | Severity | Warum es wichtig ist | Gegenmaßnahme |
| --- | --- | --- | --- |
| API-Kosten laufen hoch | Hoch | Places APIs werden bei Wachstum teuer | Budgetlimit, Cache, Details lazy, Feature Flag |
| Provider-Daten dürfen nicht lange gecacht werden | Hoch | Terms können Cache-Strategie begrenzen | Provider-Terms vor Implementierung prüfen |
| Standort-Datenschutz | Hoch | Location ist sensibel und App-Store-relevant | When-in-use only, Stadt-Fallback, Privacy-Update |
| DACH-Datenqualität variiert | Mittel | Foursquare/Yelp können schwach sein | Teststädte vergleichen |
| Map-Performance | Mittel | Viele Marker können ruckeln | Marker limitieren, Clustering ab 20 sichtbaren Markern |
| Map-Pan erzeugt zu viele API-Calls | Hoch | Jede Bewegung könnte teuer werden | 500 ms Debounce, Bounding-Box-Cache, kein Fetch bei minimalem Pan |
| Provider-Ausfall oder 429 | Mittel | Nutzer sehen keine Ergebnisse | Cache-Fallback, klare Fehlermeldung |
| Mehr Edge Functions erhöhen Wartung | Mittel | Neue Provider und Cachelogik | Provider-Abstraktion klein halten |
| App-Bundle wächst | Niedrig | Map Libraries können groß sein | Bundle nach Installation von `react-native-maps` messen |

## 2. Produkt-Risiken

| Risiko | Severity | Erklärung | Gegenmaßnahme |
| --- | --- | --- | --- |
| Verwässert App-Identität | Hoch | Wine Scanner könnte beliebig wirken | Wein- und Genusspositionierung in Karte, Liste und Marker-Details |
| Kein echter Vorteil gegenüber Google | Hoch | Nutzer öffnen dann direkt Google Maps | Speichern, Weinbezug, weniger bessere Vorschläge |
| Zu frühe Komplexität | Mittel | Karte, KI, Reservierung gleichzeitig überladen | MVP bewusst begrenzen |
| Nutzer geben Standort nicht frei | Mittel | Feature wirkt leer | Manuelle Stadt-Suche gleichwertig |
| Wein-Matching wirkt fake | Mittel | Ohne echte Weinkarten nur Vermutung | Erst "weinfreundlich light", Matching später |
| Restaurantbewertungen bleiben leer | Mittel | Eigene Community braucht Zeit | Besuche minimal erfassen, nicht zu früh darauf bauen |

## 3. Business-Risiken

| Risiko | Severity | Erklärung | Gegenmaßnahme |
| --- | --- | --- | --- |
| Affiliate bringt anfangs keinen Umsatz | Hoch | Kleine Nutzerzahl, unklare Partner | Nicht als Break-even-Basis planen |
| API-Partner lehnt Zugang ab | Mittel | TheFork/OpenTable/Quandoo brauchen Partnerprozess | MVP nicht davon abhängig machen |
| Premium kommt zu früh | Mittel | Nutzer akzeptieren Paywall erst bei klarem Wert | Premium erst nach Nutzungsdaten |
| Sponsored Empfehlungen schaden Vertrauen | Mittel | Empfehlungen dürfen nicht gekauft wirken | Erst viel später, klar labeln |

## 4. Datenschutz und App Store Risiken

| Thema | Risiko | Muss vor Release geklärt werden |
| --- | --- | --- |
| Location Permission | Apple prüft Zwecktext | Deutscher, konkreter Permission-Text |
| Privacy Nutrition | Standortdaten müssen angegeben werden | App Store Connect aktualisieren |
| Privacy Policy | Standort und externe Provider fehlen heute | Datenschutzseite aktualisieren |
| Drittanbieter | Google/Foursquare/Yelp als Empfänger | DPA/Terms und Datenschutzhinweise prüfen |
| Tracking | Keine Werbe-/Tracking-Nutzung geplant | Klar dokumentieren |

## 5. Offene Fragen an Lukas

### Produkt

1. Soll der neue Tab wirklich `Entdecken` heißen?
2. Ist der erste Markt DACH-only oder direkt EU/global?
3. Was ist wichtiger: spontan in der Nähe oder Reiseplanung?
4. Welche Persona priorisieren wir zuerst: spontaner Genießer, Reisender oder Sommelier-Hobbyist?
5. Sind Weinbars genauso wichtig wie Restaurants?
6. Soll Fine Dining sichtbar sein oder eher alltagstaugliche gute Restaurants?

### Business

1. Welches monatliche API-Budget ist zum Start okay?
2. Soll das Feature kostenlos bleiben oder später Premium werden?
3. Ist Affiliate/Reservierung ein Ziel oder erstmal egal?
4. Gibt es Kontakte zu Restaurants, Weinbars, Falstaff oder Gastro-Partnern?
5. Soll Wine Scanner langfristig auch Restaurants bewerben dürfen oder strikt neutral bleiben?

### Technik

1. Google Cloud Billing für Places API vorhanden oder neu anlegen?
2. Soll Foursquare parallel als zweite Datenquelle getestet werden?
3. Standortfreigabe im ersten MVP ja oder erst Stadt-Suche?
4. Soll Karte, Liste oder Toggle als Default-Ansicht starten?
5. Gibt es bevorzugte Teststädte?
6. Soll die Karte im Standard-Google-Look starten oder direkt im Wine-Scanner-Stil?
7. Sollen Marker Standard-Pins, Wein-Icons oder farbcodierte Bewertungsmarker sein?
8. Soll "aktuell offen" direkt auf dem Marker sichtbar sein?

### Legal

1. Wer aktualisiert Datenschutzseite und App Store Privacy?
2. Soll Standort nur für Suche verwendet werden oder auch als Besuchshistorie?
3. Müssen wir einen Datenschutzberater über Google Places/Foursquare schauen lassen?

## 6. Entscheidung, die vor Sprint 21 fallen muss

Für einen sauberen Start braucht es diese fünf Entscheidungen:

| Entscheidung | Empfehlung |
| --- | --- |
| Primärprovider | Google Places |
| Kostenlimit | 200 bis 400 EUR pro Monat für Map-MVP |
| UI-Scope | Karte und Liste im MVP |
| Standort | Optional, Stadt-Suche gleichwertig |
| Positionierung | Genuss- und weinfreundliche Restaurant-Entdeckung |

## 7. No-Go-Liste für den ersten Sprint

Nicht im ersten Restaurant-Sprint:

- Scraping von Falstaff, Michelin, Google oder Tripadvisor.
- API-Key im Mobile-Bundle.
- Permanente Standortverfolgung.
- In-App-Reservierung ohne Partnervertrag.
- Bezahlte Restaurantplatzierungen.
- KI-Matching ohne ausreichende Datenbasis.

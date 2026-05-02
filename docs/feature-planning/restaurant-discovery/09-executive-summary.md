# Restaurant-Discovery: Executive Summary

Stand: 2026-05-01

## Empfehlung

Wine Scanner sollte Restaurant-Discovery bauen, aber nicht als Google-Maps-Kopie. Der richtige Ansatz ist ein eigener Tab `Entdecken`, der Nutzern schnell gute Restaurants und Weinorte zeigt. Der Fokus ist Genuss, Wein und Vertrauen, nicht maximale Ergebnisanzahl.

Empfohlener MVP:

- Standort optional, Stadt-Suche gleichwertig.
- Google Maps Karte ist Pflicht im MVP.
- Karte und Restaurant-Liste als Toggle.
- Google Places als erste Datenquelle.
- Supabase Edge Functions für API-Keys und Kostenkontrolle.
- Restaurantdaten gecacht in Postgres.
- Marker mit Mini-Info, Tap führt ins Detail.
- Detailseite mit Foto, Bewertung, Öffnungszeiten, Adresse, Website und Navigation.
- Restaurant speichern.
- Keine In-App-Reservierung im ersten Schritt.
- Keine KI-Empfehlung im ersten Schritt.

## Warum so

Lukas Problem ist nicht, dass es keine Restaurantdaten gibt. Das Problem ist Entscheidungssicherheit:

- Zu viele Restaurants.
- Bewertungen sind schwer einzuordnen.
- Google sagt wenig über Weinqualität.
- Im Urlaub oder spontan fehlt Vertrauen.

Wine Scanner kann langfristig anders sein, weil die App das Weinprofil des Nutzers kennt. Aber dafür braucht es zuerst Nutzungsdaten: Welche Restaurants werden geöffnet, gespeichert und besucht?

## API-Strategie

| Anbieter | Rolle |
| --- | --- |
| Google Places | MVP-Favorit wegen bester DACH-Abdeckung |
| Foursquare | Kosten-Alternative und Vergleich |
| Quandoo/OpenTable/TheFork | Später für Reservierung |
| Falstaff/Michelin/Gault&Millau | Nur über Lizenz oder Link-Out, nicht scrapen |

Google ist nicht billig. Deshalb:

- Budgetlimit setzen.
- Suchergebnisse cachen.
- Details erst beim Öffnen laden.
- Map-Bewegungen debouncen.
- Bounding-Box-Cache nutzen.
- Providerfehler sauber abfangen.

Wichtig: Die offizielle Google-Preistabelle listet `Maps SDK` aktuell als `Unlimited`. Teuer werden vor allem Places, Geocoding, Photos und zu viele Re-Fetches, nicht die reine native iOS-Kartenanzeige.

## Roadmap

1. App-Store-Launch der Kern-App abschließen.
2. Sprint 21: Foundation, Datenmodell, Location-Konzept, Edge Function Skeleton.
3. Sprint 22: Google Map und Liste mit Toggle.
4. Sprint 23: Google Places Integration, Marker und Cache.
5. Sprint 24: Detail-View, Filter, Navigation und Reservierungslinks.
6. Sprint 25: Performance, Clustering, TestFlight, Datenschutz, Polish.
7. Sprint 26: App Store Update.

## Wichtigste Risiken

- API-Kosten steigen bei Wachstum.
- Map-Panning kann zu viele Places-Calls erzeugen, wenn es nicht gedrosselt wird.
- Restaurant-Feature wirkt zu generisch.
- Standort-Datenschutz muss sauber erklärt werden.
- Reservierungsanbieter brauchen Partnerzugang.
- Wein-Matching ohne echte Daten wäre zu früh.

## Entscheidungen für Lukas

Vor Start des Implementierungs-Sprints klären:

- Monatliches API-Budget, Empfehlung: 200 bis 400 EUR für Map-MVP.
- Testmärkte: DACH-only oder direkt EU?
- Tab-Name: Empfehlung `Entdecken`.
- Liste oder Karte als Default-View? Empfehlung: Karte zuerst nach Standort oder Stadt.
- Karten-Style: Standard Google Maps oder eigener Wine-Scanner-Stil?
- Marker-Design: Standard-Pins, Wein-Icon oder Farbcodierung nach Bewertung?
- Soll "aktuell offen" direkt auf dem Marker sichtbar sein?
- Google Places Billing und API-Key vorhanden?
- Soll der Fokus eher spontan, Reise oder Weinbar/Fine Dining sein?

## Klare Go/No-Go-Empfehlung

Go, aber schlank starten.

Der erste Release soll beweisen, dass Nutzer Wine Scanner auch öffnen, wenn sie ein gutes Restaurant suchen. Erst wenn das klappt, lohnen sich Map, Restaurantbewertungen, Weinprofil-Matching und Reservierungs-Partner.

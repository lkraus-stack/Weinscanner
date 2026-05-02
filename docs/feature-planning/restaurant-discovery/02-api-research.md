# Restaurant-Discovery: API-Recherche

Stand: 2026-05-01

## Kurzfazit

Für ein DACH-taugliches MVP ist Google Places technisch die sicherste Datenquelle, aber nur mit konsequentem Caching und Budget-Limits. Foursquare ist die wichtigste Kosten-Alternative. Yelp kann ergänzen, ist aber wegen DACH-Abdeckung und 24-Stunden-Cache-Limit weniger gut passend. TheFork, Quandoo und OpenTable sind eher Reservierungs- und Partner-APIs, nicht die ideale erste Datenbasis für allgemeine Restaurant-Suche. Falstaff, Michelin und Gault&Millau sind strategisch spannend, aber eher Lizenz- oder Partnerschaftsthemen.

Empfehlung:

1. MVP: Google Maps plus Google Places API, Karte und Liste im Toggle, stark gecacht.
2. Parallel evaluieren: Foursquare Places als günstigere Alternative.
3. Später: Quandoo oder OpenTable für Reservierungslinks, TheFork/Falstaff/Michelin nur bei Partnerschaft oder klarer Lizenz.

## Bewertungsmatrix

| API | DACH-Coverage | Datenqualität | Pricing für Indie | Zugang | Empfehlung |
| --- | --- | --- | --- | --- | --- |
| Google Places | Sehr hoch | Sehr hoch | Mittel bis teuer | Self-service | MVP-Favorit |
| Foursquare Places | Hoch | Gut | Gut bis mittel | Self-service | Starke Alternative |
| Yelp Places | Mittel | Gut, aber Yelp-lastig | Unklar ab Paid | Self-service plus Paid | Ergänzung, nicht primär |
| Tripadvisor Content API | Hoch im Reisebereich | Gut für Reviews | Unklar | Approval nötig | Später prüfen |
| Quandoo | DACH-stark bei Reservierungen | Gut bei Partnerrestaurants | Vertrag/Partner | Partner API | Reservierung später |
| OpenTable | International, DACH unklar | Gut bei Partnerrestaurants | Partner | Partner API | Reservierung später |
| TheFork | Europa-stark, DACH je nach Stadt | Gut bei Partnerrestaurants | Vertrag/Partner | Partner API | Später, wenn Zugang |
| Falstaff | DACH sehr relevant | Premium/wein-nah | Lizenz unklar | Kein Public API gefunden | Premium-Layer später |
| Michelin Guide | Premium global | Sehr hoch kuratiert | Lizenz unklar | Kein Public API gefunden | Premium-Layer später |
| Gault&Millau | DACH/Europa relevant | Hoch kuratiert | Lizenz unklar | Kein Public API gefunden | Premium-Layer später |

## 1. Google Places API

### Was Google liefert

Google Places ist für Restaurant-Suche am vollständigsten und passt gut zu Google Maps im MVP:

- Nearby Search und Text Search.
- Place Details.
- Fotos.
- Adresse, Standort, Typen.
- Bewertungen und Anzahl Bewertungen.
- Öffnungszeiten.
- Preisniveau.
- Restaurantmerkmale wie `servesWine`, `servesDinner`, `outdoorSeating` je nach Feldtier.
- Konsistente Place IDs für Marker, Detailseiten und externe Google Maps Links.

Wichtig: Google Places API (New) arbeitet mit Field Masks. Ohne konkrete Felder wird die Anfrage nicht akzeptiert, und die gewählten Felder bestimmen die Kostenklasse.

### Pricing Stand 2026

Google nennt Preise pro 1.000 Events, mit Free Usage Caps pro SKU. Aus der offiziellen Preistabelle:

| SKU | Free Cap pro Monat | Preis bis 100.000 Events |
| --- | ---: | ---: |
| Text Search Pro | 5.000 | 32 USD pro 1.000 |
| Nearby Search Pro | 5.000 | 32 USD pro 1.000 |
| Place Details Pro | 5.000 | 17 USD pro 1.000 |
| Text Search Enterprise | 1.000 | 35 USD pro 1.000 |
| Nearby Search Enterprise | 1.000 | 35 USD pro 1.000 |
| Place Details Enterprise | 1.000 | 20 USD pro 1.000 |
| Place Details Photos | 1.000 | 7 USD pro 1.000 |

Für Wine Scanner ist der wichtige Haken: Ratings, User Rating Count, Preis und Öffnungszeiten liegen in Enterprise-Feldern. Ein Restaurantfinder ohne Bewertungen löst Lukas Problem aber nicht. Daher sollte das Kostenmodell realistisch mit Enterprise-Feldern rechnen.

Für die Karte selbst ist wichtig: Die offizielle Google Maps Platform Preistabelle listet `Maps SDK` aktuell als `Unlimited`. Das bedeutet: Die iOS-Kartenanzeige über das native Maps SDK ist Stand 2026-05-01 nicht der Kostentreiber. Teuer werden Places-Suchen, Details, Photos und Geocoding. Ältere Rechnungen mit 28.000 kostenlosen Map-Loads oder 200 USD monatlichem Credit stammen aus einem älteren Preismodell und sollten vor Sprintstart nicht als Planungsbasis verwendet werden.

### Vorteile

- Beste DACH-Abdeckung.
- Sehr gute Restaurant-Grunddaten.
- Nutzer vertrauen Google-Bewertungen.
- Gute Fotos und Öffnungszeiten.
- Gleiche Datenquelle für Karte, Marker und Restaurantdetails.
- Stabiler Anbieter.

### Nachteile

- Kosten können bei Wachstum stark steigen.
- Caching und Nutzungsrechte müssen genau geprüft werden.
- US-Anbieter, also Privacy- und Vertragsthema.
- Wine-spezifische Daten wie echte Weinkarte fehlen.
- Google Maps SDK braucht trotzdem Billing, API-Key und saubere Bundle-ID-Restriktion.

### MVP-Eignung

Sehr hoch, wenn:

- Places-, Details-, Geocoding- und Photo-Calls über Edge Functions laufen.
- Der Google Maps SDK Key für iOS streng auf `com.francoconsulting.winescanner` beschränkt ist.
- Search Results gecacht werden.
- Details erst beim Öffnen geladen werden.
- API-Budget und Quotas gesetzt werden.
- Die App anzeigt, dass externe Daten von Google kommen.

## 2. Foursquare Places API

### Was Foursquare liefert

Foursquare bietet POI-Suche, Details, Autocomplete, Kategorien, Fotos und Tips. Der Anbieter wirbt mit globaler POI-Abdeckung und Filtermöglichkeiten nach Kategorien, Features und Öffnungszeiten.

### Pricing Stand 2026

Offizielle Foursquare-Preise:

| Endpunkt-Typ | Free Cap | Preis danach |
| --- | ---: | ---: |
| Pro Endpoints | 10.000 Calls | 15 USD pro 1.000 bis 100.000 Calls |
| Premium Endpoints | 100.000 Calls | 18,75 USD pro 1.000 bis 100.000 Calls |

Foursquare kündigt für 2026 eine Änderung an: Ab 2026-06-01 sollen Pro-Endpunkte nur noch 500 freie Calls haben und danach bei 15 USD pro 1.000 starten. Das muss vor Implementierung nochmal geprüft werden.

### Vorteile

- Self-service und klare Preise.
- Günstiger als Google bei einfachen Suchen.
- Gute POI-Kategorien.
- Pay-as-you-go.
- Für Places-Apps konzipiert.

### Nachteile

- In DACH vermutlich schwächer als Google.
- Restaurantbewertungen sind nicht so stark im Nutzerkopf verankert.
- Fotos/Tips sind Premium.
- Ab Juni 2026 schlechtere Free-Tier-Situation.

### MVP-Eignung

Gut als Alternative oder Fallback. Für die erste echte TestFlight-Version sollte man Google und Foursquare mit denselben Städten vergleichen:

- München.
- Wien.
- Zürich.
- Berlin.
- Hamburg.
- Südtirol oder Bodensee als weinrelevante Region.

## 3. Yelp Places API

### Was Yelp liefert

Yelp bietet:

- Business Search.
- Business Details.
- Business Match.
- Bewertungen als kurze Review-Auszüge.
- Fotos, Preisniveau, Öffnungszeiten.
- Kategorien.

### Pricing und Limits

Yelp schreibt offiziell:

- Trial: 5.000 Calls im 30-Tage-Test, nicht für kommerzielles Deployment.
- Paid Plan: 30.000 API Calls pro Monat standardmäßig.
- Daily Limit: bis zu 5.000 Calls pro Tag.
- Mehr als 30.000 Calls wird in 1.000er-Schritten berechnet, Preise sind nicht öffentlich im Detail sichtbar.
- Cache: Yelp Places API Content maximal 24 Stunden, Business IDs unbegrenzt.

### Vorteile

- Gute Review- und Business-Daten.
- Business Match hilfreich, wenn man Anbieter verknüpfen will.
- Einfacher Einstieg als bei Partner-APIs.

### Nachteile

- DACH-Abdeckung und Nutzervertrauen schwächer als Google.
- 24-Stunden-Cache passt schlecht zur Wine-Scanner-Caching-Strategie.
- Keine dauerhafte Analyse der API-Daten erlaubt.
- Kommerzielle Nutzung braucht Paid Plan.

### MVP-Eignung

Nur zweite Wahl. Yelp kann später ergänzen, wenn Reviews aus bestimmten Märkten gut sind. Für Deutschland/Österreich/Schweiz sollte es nicht die Primärquelle sein.

## 4. Tripadvisor Content API

### Was Tripadvisor liefert

Tripadvisor Content API bietet laut offizieller Doku:

- Location Details für Hotels, Restaurants und Attraktionen.
- Bis zu 5 Reviews und 5 Fotos pro Location.
- Location Search und Nearby Location Search.
- Bis zu 50 Calls pro Sekunde.
- Pay-only-for-what-you-use mit monatlichem Budgetlimit.

Die alte Developer-FAQ sagt zusätzlich, dass während Entwicklung/QA oft 1.000 Calls pro Tag gelten und nach Launch 10.000 Calls pro Tag möglich sind. Diese Seite ist aber als veraltet markiert, deshalb nur als Hinweis betrachten.

### Vorteile

- Gute Reisedaten.
- Restaurantbewertungen im Urlaubskontext relevant.
- Fotos und Reviews offiziell verfügbar.

### Nachteile

- Zugang und Preis nicht so transparent wie Google/Foursquare.
- Approval und Display-Richtlinien.
- Stark touristisch geprägt.
- Nicht ideal als erster technischer Baustein.

### MVP-Eignung

Mittel. Für Persona "Reisender" spannend, aber als erste Datenquelle zu viel Zugangsrisko.

## 5. TheFork

### Was TheFork liefert

TheFork hat offizielle APIs, aber die Doku ist klar auf Partner, Restaurants, Gruppen, CRM und Reservierungs-Workflows ausgerichtet:

- Booking Funnel.
- Real-time availabilities.
- Reservation lifecycle.
- Reservation Webhooks.
- Preset Menus.

Zugang läuft nicht einfach anonym self-service. Credentials müssen über TheFork bezogen werden.

### Vorteile

- Reservierungsnah.
- In Europa stark.
- Michelin-Verbindung über TheFork-Ökosystem strategisch interessant.

### Nachteile

- Kein klarer Public Places Search Fit für Indie-MVP.
- Partnerzugang nötig.
- DACH-Abdeckung muss konkret geprüft werden.
- Nicht als allgemeine Restaurantdatenbank starten.

### MVP-Eignung

Nicht als Primärquelle. Später als Reservierungs-Partner prüfen.

## 6. OpenTable

### Was OpenTable liefert

OpenTable bietet API-Integrationen für Partner:

- Sync API.
- Booking API.
- CRM API.
- Directory API mit Restaurantdaten und Reservierungslinks.
- JSON/REST API, Partnerbewerbung erforderlich.

### Vorteile

- Sauberer Reservierungs-Use-Case.
- Directory API mit Reservation Links ist für externe Weiterleitung interessant.
- Bekannter Anbieter.

### Nachteile

- Zugang über Partnerprozess.
- DACH-Coverage unklarer als Quandoo/TheFork/Google.
- Kein klarer erster Schritt für Discovery.

### MVP-Eignung

Später für Reservierungslinks. Nicht für MVP-Kernsuche.

## 7. Quandoo

### Was Quandoo liefert

Quandoo hat eine Public/Partner API und ist in Deutschland, Österreich und Schweiz vertreten. Die Doku nennt:

- Merchant Availability.
- List Merchants nach Ort, Datum, Uhrzeit und Personenanzahl.
- Reservation Create/Update.
- Widget-, Portal- und Direct-Integration.
- Kontakt für Public API: `publishers@quandoo.com`.

### Vorteile

- DACH-relevant.
- Reservierungsdaten und echte Verfügbarkeiten.
- Partnerrestaurants in Europa/APAC.

### Nachteile

- Fokus auf Reservierung, nicht volle Discovery-Datenbank.
- Partnerzugang und Attribution.
- Nur Quandoo-Partnerrestaurants.

### MVP-Eignung

Sehr interessant für Sprint nach MVP. Für das erste Restaurant-Discovery kann Quandoo als externer Reservierungslink oder zweiter Schritt geplant werden.

## 8. Falstaff, Michelin, Gault&Millau

### Falstaff

Falstaff ist für Wine Scanner besonders interessant, weil Wine, Food und DACH zusammenpassen. Offiziell zeigt Falstaff umfangreiche Restaurant- und Location-Guides und spricht von über 18.000 Restaurant-Einträgen auf der Website. Ein öffentliches API wurde nicht gefunden.

### Michelin Guide

Der Michelin Guide bietet offizielle Restaurant- und Hoteldaten über Website und App. Ein öffentliches Entwickler-API wurde nicht gefunden. Datenpartnerschaften gibt es offenbar mit großen Plattformen, aber das ist ein Lizenzthema.

### Gault&Millau

Gault&Millau ist ein internationaler Gourmetguide mit länderspezifischen Plattformen. Ein öffentliches API wurde nicht gefunden.

### Bewertung

Diese Quellen wären perfekt für eine Premium-Schicht:

- "Ausgezeichnete Weinrestaurants".
- "Falstaff/Fine Dining Empfehlungen".
- "Michelin/Bib Gourmand in der Nähe".

Aber: Nicht scrapen, nicht in MVP als Datenquelle einplanen. Nur über offizielle Lizenz, Link-Out oder Partnerschaft.

## Top-3 Empfehlung

### 1. Google Places API als MVP-Datenquelle

Warum:

- Höchste Wahrscheinlichkeit, dass Lukas und Testnutzer gute Ergebnisse in DACH sehen.
- Bewertungen, Fotos und Öffnungszeiten sind entscheidend für das Nutzerproblem.
- Schnellster Weg zu echtem Wert.

Absicherung:

- Budgetlimit im Google Cloud Projekt.
- Search-Cache in Supabase.
- Details nur lazy laden.
- Keine breite Kartenansicht im ersten Schritt, weil Map-Loads und UX-Komplexität unnötig sind.

### 2. Foursquare als Kosten- und Provider-Alternative

Warum:

- Self-service.
- Gute Places-Suche.
- Preise oft einfacher planbar.
- Gut als A/B-Vergleich zu Google.

Absicherung:

- Vor Sprintstart DACH-Testdatensatz prüfen.
- Premium-Felder vermeiden, wenn nicht nötig.

### 3. Quandoo/OpenTable als Reservierungs-Layer

Warum:

- Restaurant-Discovery endet oft bei Reservierung.
- OpenTable Directory API und Quandoo Merchant APIs sind dafür passender als für allgemeine Suche.

Aber:

- Nicht MVP-Blocker.
- Erst nach validiertem Discovery-Use-Case verhandeln.

## Quellen

- [Google Places API Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Google Maps Platform Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Foursquare Pricing](https://foursquare.com/pricing/)
- [Foursquare Upcoming Changes](https://docs.foursquare.com/developer/reference/upcoming-changes)
- [Yelp Places API Overview](https://docs.developer.yelp.com/docs/places-intro)
- [Yelp Places API FAQ](https://docs.developer.yelp.com/docs/places-faq)
- [Tripadvisor Content API](https://tripadvisor-content-api.readme.io/reference/overview)
- [Tripadvisor Content API FAQ](https://developer-tripadvisor.com/content-api/FAQ/)
- [TheFork Developer Portal](https://docs.thefork.io/preliminary-steps)
- [TheFork B2B API](https://docs.thefork.io/B2B-API/introduction)
- [OpenTable API Partners](https://www.opentable.com/restaurant-solutions/api-partners/)
- [OpenTable API FAQ](https://www.opentable.com/restaurant-solutions/api-partners/faqs/)
- [Quandoo Public API](https://docs.quandoo.com/)
- [Quandoo Availability API](https://docs.quandoo.com/check-availability/)
- [Falstaff About Us](https://www.falstaff.com/en/about-us)
- [Falstaff Restaurants](https://www.falstaff.com/en/restaurants)
- [MICHELIN Guide](https://guide.michelin.com/)
- [Gault&Millau](https://www.gaultmillau.com/)

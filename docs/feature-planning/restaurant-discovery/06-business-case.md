# Restaurant-Discovery: Kosten und Business-Case

Stand: 2026-05-01

## Kurzfazit

Restaurant-Discovery kann für Wine Scanner wertvoll sein, aber API-Kosten müssen von Anfang an kontrolliert werden. Das Feature sollte in der ersten Version nicht auf direkte Monetarisierung angewiesen sein. Es sollte validieren, ob Nutzer den Tab wirklich verwenden, Restaurants speichern und später Besuche erfassen.

Die realistischste erste Rechnung:

- MVP kostet vor allem Entwicklungszeit und Google/Foursquare API-Nutzung.
- Karte ist jetzt MVP-Pflicht. Die iOS-Kartenanzeige über Google Maps SDK ist laut offizieller Preistabelle aktuell `Unlimited`, aber sie erhöht die Wahrscheinlichkeit vieler Places- und Geocoding-Calls.
- Bei 100 bis 1.000 Nutzern bleibt es mit Caching voraussichtlich beherrschbar.
- Bei 10.000 Nutzern kann Google Places ohne Caching schnell vierstellig pro Monat werden.
- Affiliate-Erlöse sind erst sinnvoll, wenn Reservierungspartner eingebunden sind.

## 1. Annahmen für Kostenmodell

Basisannahmen für normales MVP-Verhalten:

| Nutzerzahl | Restaurant-Suchen pro User/Monat | Detail-Öffnungen pro User/Monat | Foto-Loads über Provider |
| ---: | ---: | ---: | ---: |
| 100 | 4 | 2 | 2 |
| 1.000 | 4 | 2 | 2 |
| 10.000 | 4 | 2 | 2 |

Ohne Cache:

| Nutzerzahl | Suchen | Details | Fotos |
| ---: | ---: | ---: | ---: |
| 100 | 400 | 200 | 200 |
| 1.000 | 4.000 | 2.000 | 2.000 |
| 10.000 | 40.000 | 20.000 | 20.000 |

Mit Cache kann man je nach Stadt und Wiederholung 30 bis 70 Prozent der Search Calls sparen. Für konservative Planung rechne ich unten erstmal ohne starken Cache-Vorteil und notiere danach die erwartete Entlastung.

Zusätzliche Karten-Stress-Annahme aus dem Map-MVP:

| Kennzahl | Annahme |
| --- | ---: |
| Map-Interaktionen pro Session | 5 |
| Restaurant-Sessions pro aktivem User und Tag | 3 |
| Aktive User | 1.000 |
| Monatliche Map-Interaktionen | ca. 450.000 |

Wichtig: Diese 450.000 Interaktionen sind nicht automatisch 450.000 kostenpflichtige Map-Loads. Laut offizieller Google-Preistabelle ist `Maps SDK` aktuell `Unlimited`. Kosten entstehen vor allem, wenn jede Bewegung eine Places- oder Geocoding-Abfrage auslöst. Deshalb sind Debounce, Bounding-Box-Cache und Query-Limits Pflicht.

## 2. Google Places Kostenprojektion

Für ein gutes Restaurantprodukt braucht man Ratings, Rating Count, Preisniveau und Öffnungszeiten. Diese Felder liegen bei Google im Enterprise-Bereich. Daher die konservative Rechnung:

- Suche: Nearby Search oder Text Search Enterprise, 35 USD pro 1.000 nach 1.000 Free Cap.
- Details: Place Details Enterprise, 20 USD pro 1.000 nach 1.000 Free Cap.
- Fotos: Place Details Photos, 7 USD pro 1.000 nach 1.000 Free Cap.

| Nutzerzahl | Grobe monatliche Google-Kosten ohne Cache |
| ---: | ---: |
| 100 | ca. 0 USD, unter Free Caps |
| 1.000 | ca. 132 USD |
| 10.000 | ca. 1.878 USD |

Berechnung 1.000 Nutzer:

- Search: 4.000 minus 1.000 Free Cap = 3.000 * 35 USD/1.000 = 105 USD.
- Details: 2.000 minus 1.000 = 1.000 * 20 USD/1.000 = 20 USD.
- Fotos: 2.000 minus 1.000 = 1.000 * 7 USD/1.000 = 7 USD.

Mit 50 Prozent Search-Cache-Rate könnte 1.000 Nutzer eher bei ca. 60 bis 90 USD landen. Bei 10.000 Nutzern bleibt es trotzdem ein relevantes Kostenthema.

## 2.1 Google Maps SDK und Map-Load-Kosten

Stand 2026-05-01 laut offizieller Google Maps Platform Pricing List:

| Google Maps Produkt | Free Usage |
| --- | --- |
| Maps SDK | Unlimited |
| Dynamic Maps Web | Free Cap 10.000, danach kostenpflichtig |
| Map Tiles API | Free Cap 100.000, danach kostenpflichtig |

Konsequenz für Wine Scanner:

- Die native iOS-Karte selbst ist aktuell nicht der Hauptkostentreiber.
- Billing und API-Key sind trotzdem Pflicht.
- Die alte Faustregel "28.000 Map-Loads durch 200 USD Credit" sollte nicht als aktuelle Planung verwendet werden, da Google seit 2025 auf Free Usage Caps und neue Kategorien umgestellt hat.
- Wenn wir irgendwann Web Maps oder Map Tiles nutzen, muss die Rechnung neu gemacht werden.

### Kostenrisiko durch Kartenverhalten

Wenn 1.000 aktive User die Karte intensiv nutzen und jede Session einen kalten Places Search auslöst:

| Szenario | Places Search Calls/Monat | Grobe Search-Kosten ohne Cache |
| --- | ---: | ---: |
| 1 Call pro Session | 90.000 | ca. 3.115 USD |
| 1 Call pro Session, 80 Prozent Cache-Hit | 18.000 | ca. 595 USD |
| 1 Call pro 5 Sessions, 80 Prozent Cache-Hit | 3.600 | ca. 91 USD |

Diese Tabelle zeigt: Nicht die Karte ist teuer, sondern schlechte Fetch-Logik. Das MVP muss Map-Bewegungen zusammenfassen und gecachte Bounding-Boxes wiederverwenden.

## 3. Foursquare Kostenprojektion

Foursquare ist günstiger, wenn Pro-Endpunkte reichen:

- Aktuell: 10.000 Pro Calls frei, danach 15 USD pro 1.000.
- Ab 2026-06-01 laut Foursquare Änderung: nur noch 500 Pro Calls frei, danach 15 USD pro 1.000.
- Premium für Fotos/Tips aktuell 18,75 USD pro 1.000, mit anderer Free-Tier-Logik.

Vereinfachte Pro-Rechnung mit 5 Calls pro Nutzer/Monat:

| Nutzerzahl | Calls | Kosten aktuell | Kosten nach angekündigter Änderung |
| ---: | ---: | ---: | ---: |
| 100 | 500 | 0 USD | 0 USD |
| 1.000 | 5.000 | 0 USD | ca. 67,50 USD |
| 10.000 | 50.000 | ca. 600 USD | ca. 742,50 USD |

Foursquare ist damit für Scale attraktiver als Google, aber nur wenn die DACH-Datenqualität reicht.

## 4. Yelp Kostenprojektion

Yelp nennt öffentlich:

- 5.000 Trial Calls in 30 Tagen, nicht für kommerziellen Launch.
- Paid Plan mit 30.000 Calls pro Monat standardmäßig.
- 5.000 Calls pro Tag als Standardlimit.
- Kosten über 30.000 Calls werden in 1.000er-Schritten abgerechnet, konkrete Preise nicht öffentlich im Docs-Auszug.

Für 10.000 Nutzer wäre Yelp ohne gute Caching- und Planvereinbarung unsicher. Außerdem dürfen API-Inhalte nur maximal 24 Stunden gecacht werden. Das passt schlechter zum Supabase-Cache-Modell.

## 5. Tripadvisor Kostenprojektion

Tripadvisor kommuniziert "pay only for what you use" und Budgetlimits, aber keine direkt verwertbare öffentliche Preistabelle im recherchierten Docs-Stand. Zugang und Display-Anforderungen sind relevanter als die reine Kostenrechnung.

Für MVP deshalb nicht als Primärquelle planen.

## 6. Reservierungsanbieter

TheFork, Quandoo und OpenTable sind eher Partner- oder Reservierungs-APIs. Die Kosten sind vermutlich vertraglich oder abhängig vom Partnerprogramm.

Für Business Case wichtig:

- Reservierungen können Affiliate oder Provision ermöglichen.
- Aber der Zugang ist nicht garantiert.
- Ohne Vertrag sollte das MVP nur externe Links nutzen.

## 7. Entwicklungsaufwand

| Scope | Aufwand | Komplexität | Kommentar |
| --- | ---: | --- | --- |
| MVP mit Karte | 5 bis 6 Wochen | Mittel bis hoch | Karte, Liste, Suche, Cache, Detail, speichern |
| Erweiterung | 4 bis 6 Wochen | Mittel bis hoch | Besuche, eigene Bewertungen, Wine-Verknüpfung, Reservierung |
| Vollausbau | 3 bis 6 Monate | Hoch | KI-Matching, Reservierungen, Guides, Social |

### MVP-Aufwand grob

| Bereich | Aufwand |
| --- | ---: |
| Datenmodell und RLS | 1 bis 2 Tage |
| Edge Functions und Provider-Mapping | 3 bis 5 Tage |
| UI Tab, Liste, Detail | 4 bis 6 Tage |
| Map-Integration, Marker, Toggle | 4 bis 6 Tage |
| Clustering und Map-Performance | 2 bis 4 Tage |
| Standort und Fallback | 1 bis 2 Tage |
| Cache und Kostenlimits | 2 Tage |
| Tests und TestFlight | 2 bis 4 Tage |

## 8. Monetarisierung

### Affiliate Reservierungen

Potenzial:

- Reservierungslink zu OpenTable, Quandoo oder TheFork.
- Trackbare Partnerlinks.
- Einnahme pro bestätigter Reservierung oder Provision.

Risiko:

- Partnerzugang unklar.
- Kleine Nutzerzahl bringt wenig Umsatz.
- Provisionen können niedrig oder nicht verfügbar sein.

### Premium

Mögliche Premium-Features:

- Weinfreundliche Filter.
- Gespeicherte Restaurantlisten für Reisen.
- Erweiterte Weinprofil-Empfehlungen.
- "Restaurants passend zu deinem Bestand".
- Premium-Guides, falls lizenziert.

Vorteil:

- Besser kontrollierbar als Affiliate.

Nachteil:

- Muss echten Mehrwert liefern.
- Nicht zu früh paywallen.

### Sponsored Restaurants

Für später, aktuell nicht empfehlenswert.

Warum:

- Risiko für Vertrauen.
- Wine Scanner ist noch im Launch.
- Empfehlung muss glaubwürdig bleiben.

## 9. Break-even grob

Konservative Annahmen:

- 1.000 aktive Nutzer.
- 4 Suchen pro Monat.
- Google-Kosten grob 60 bis 130 USD mit Cache.
- Reservierungs-Conversion 1 bis 3 Prozent der aktiven Nutzer.
- Provision je bestätigter Reservierung unbekannt, konservativ 0,50 bis 2,00 EUR.

| Szenario | Reservierungen/Monat | Erlös bei 1 EUR | Deckt Google-Kosten? |
| --- | ---: | ---: | --- |
| 1 Prozent von 1.000 | 10 | 10 EUR | Nein |
| 3 Prozent von 1.000 | 30 | 30 EUR | Eher nein |
| 10 Prozent von 1.000 | 100 | 100 EUR | Vielleicht |

Fazit: In der Frühphase darf das Feature nicht auf Affiliate-Break-even angewiesen sein. Es muss zuerst Retention und Produktwert erhöhen.

## 10. Business-Empfehlung

1. MVP mit API-Budgetlimit starten.
2. Kein In-App-Reservierungsversprechen im ersten Release.
3. Google Places nutzen, aber Foursquare parallel testen.
4. Erfolg über Nutzung messen, nicht Umsatz.
5. Nach 4 bis 8 Wochen entscheiden, ob Reservierungs-Partner Sinn ergibt.

## Budget-Leitplanken

Für den Start:

| Phase | Monatsbudget |
| --- | ---: |
| TestFlight intern | 25 bis 50 EUR |
| App-Store-MVP klein | 200 bis 400 EUR |
| Skalierung über 1.000 aktive Nutzer | Neu kalkulieren |

Technisch:

- Provider-Quotas setzen.
- Edge Function stoppt bei Budgetflag.
- Cache-Hit-Rate im Audit verfolgen.
- Notfall: Feature per Remote Flag deaktivieren.

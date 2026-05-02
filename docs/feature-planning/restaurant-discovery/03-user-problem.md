# Restaurant-Discovery: User-Problem

Stand: 2026-05-01

## Ausgangspunkt

Lukas beschreibt das Problem so:

> Wir haben häufig das Problem, dass wir kein Restaurant finden oder uns schwer tun, ein gutes mit guten Bewertungen zu finden.

Das klingt zuerst wie ein Google-Maps-Problem. Für Wine Scanner ist aber die spannendere Frage: Warum reicht Google Maps nicht?

Die Antwort ist wahrscheinlich nicht "es gibt keine Restaurants". Die Antwort ist eher:

- Es gibt zu viele Ergebnisse.
- Bewertungen wirken beliebig.
- Gute Bewertungen bedeuten nicht automatisch guter Wein, gutes Ambiente oder passendes Preisniveau.
- Im Urlaub oder in fremden Städten fehlt Vertrauen.
- Für Genussmenschen ist "gut" mehr als 4,6 Sterne.

## Was bedeutet "gut" konkret?

Für Wine Scanner sollte "gut" mehrdimensional sein:

| Dimension | Frage für den Nutzer |
| --- | --- |
| Essen | Ist die Küche wirklich gut, nicht nur okay bewertet? |
| Wein | Gibt es gute Weinbegleitung, Weinkarte, Sommelier, regionale Weine? |
| Stil | Passt es zu Date, Business, Abend mit Freunden, Urlaub? |
| Preis-Leistung | Ist es dem Anlass angemessen? |
| Sicherheit | Ist es offen, aktuell, nicht touristisch schlecht? |
| Nähe | Ist es jetzt erreichbar? |
| Vertrauen | Kommt die Empfehlung von Daten, eigenen Vorlieben oder Community? |

Für einen Wein-App-Nutzer ist besonders wichtig: Ein Restaurant kann gutes Essen haben, aber beim Wein langweilig sein. Genau dort kann Wine Scanner langfristig anders sein.

## Wann tritt das Problem auf?

### Spontan

Der Nutzer ist unterwegs, hat Hunger und will in den nächsten 30 bis 60 Minuten etwas finden. Hier zählen:

- Nähe.
- Jetzt geöffnet.
- Verfügbarkeit.
- Schnelle Vergleichbarkeit.
- Wenige, klare Optionen.

### Geplant

Der Nutzer plant einen Abend, ein Date, Geburtstag, Geschäftsessen oder Wochenende. Hier zählen:

- Atmosphäre.
- Reservierung.
- Preisniveau.
- Fotos.
- Verlässliche Bewertungen.
- "Besonderheit" des Ortes.

### Reise

Der Nutzer ist in einer fremden Stadt oder Weinregion. Hier zählen:

- Lokale Empfehlungen.
- Touristenfallen vermeiden.
- Regionale Küche und Wein.
- Orientierung ohne Ortskenntnis.

### Wein-Erlebnis

Der Nutzer will bewusst gut essen und guten Wein trinken. Hier zählen:

- Weinbar, Sommelier, Fine Dining, regionale Weine.
- Matching zu Weinstil und Vorlieben.
- Möglichkeit, getrunkene Weine später im Wine Scanner zu speichern.

## Warum aktuelle Tools nicht reichen

| Tool | Stärke | Schwäche aus Wine-Scanner-Sicht |
| --- | --- | --- |
| Google Maps | Vollständig, schnell, aktuelle Öffnungszeiten | Zu generisch, kein Weinprofil, Bewertungen nicht genussfokussiert |
| Tripadvisor | Reisebewertungen, Fotos | Touristischer Bias, oft nicht lokal genug |
| TheFork/Quandoo/OpenTable | Reservierungen | Nur Partnerrestaurants, Discovery oft plattformgetrieben |
| Michelin/Falstaff/Gault&Millau | Kuratiert, hochwertig | Nicht vollständig, oft Premium/Fine Dining, keine persönliche Anpassung |
| Freunde/Instagram | Emotional vertrauenswürdig | Nicht systematisch, schwer auffindbar im Moment |

Wine Scanner muss also nicht "mehr Restaurants" liefern. Es muss "bessere Entscheidung in weniger Zeit" liefern.

## Persona A: Der spontane Genießer

### Profil

- Öffnet die App in einer Stadt.
- Will jetzt oder heute Abend essen.
- Hat keine Lust, 30 Google-Ergebnisse zu vergleichen.
- Mag gute Qualität, aber muss nicht Fine Dining sein.

### Journey

1. App öffnen.
2. Tab `Entdecken` öffnen.
3. Standort erlauben oder Stadt eingeben.
4. Karte mit Restaurants in der Umgebung sehen.
5. Filter: "Jetzt offen", "bis 2 km", "gut bewertet".
6. Zwischen Karte und Liste wechseln.
7. Restaurant öffnen.
8. Per Google Maps navigieren oder extern reservieren.

### Friction heute

- Zu viele Ergebnisse.
- Bewertungen schwer vergleichbar.
- Fotos und Ranking wirken willkürlich.

### Idealer Outcome

Der Nutzer findet in unter einer Minute zwei bis drei gute Optionen und fühlt sich sicher genug, loszugehen.

## Persona B: Der Reisende

### Profil

- Ist in Wien, Südtirol, München, Zürich oder einer Weinregion.
- Will lokale Qualität.
- Will keine Touristenfalle.
- Nutzt Wine Scanner ohnehin für Weine im Urlaub.

### Journey

1. Vor oder während der Reise App öffnen.
2. Stadt eingeben.
3. Filter: "regional", "weinfreundlich", "gehobenes casual".
4. Restaurants speichern.
5. Vor Ort eines auswählen.
6. Nach Besuch Restaurant und Wein verknüpfen.

### Friction heute

- Reisedaten sind touristisch.
- Lokale Qualität schwer zu erkennen.
- Empfehlungen verstreut über Blogs, Google und Guides.

### Idealer Outcome

Wine Scanner wird zum kleinen Genuss-Reiseführer: nicht vollständig, aber verlässlich und persönlich.

## Persona C: Der Sommelier-Hobbyist

### Profil

- Bewertet Weine regelmäßig.
- Hat eigenen Bestand.
- Achtet auf Rebsorten, Regionen, Jahrgänge.
- Will Restaurants mit ernsthafter Weinkultur.

### Journey

1. App öffnen.
2. "Weinfreundliche Restaurants" auswählen.
3. Nach Weinbar, Fine Dining, regionaler Weinbegleitung filtern.
4. Restaurant speichern.
5. Vor Ort Wein scannen und Besuch verknüpfen.
6. Später sehen: "Welche Restaurants haben zu meinem Geschmack gepasst?"

### Friction heute

- Google erkennt "gute Weinkarte" schlecht.
- Restaurantbewertungen enthalten zu wenig Weinqualität.
- Weinbars und Restaurants sind getrennte Kategorien.

### Idealer Outcome

Wine Scanner empfiehlt nicht nur ein Restaurant, sondern ein Wein-Erlebnis.

## Differenzierung: Was Wine Scanner besser machen kann

### 1. Weinprofil statt generischer Bewertungsdurchschnitt

Wine Scanner kennt:

- Welche Weine Nutzer mögen.
- Welche Rebsorten und Regionen häufig vorkommen.
- Welche Preisniveaus im Bestand liegen.
- Welche Anlässe in Bewertungen vorkommen.

Das kann später zu Empfehlungen führen wie:

- "Passt zu deinem Geschmack für österreichische Weißweine."
- "Gute Option, wenn du Barrique-Chardonnay magst."
- "Viele Nutzer speichern hier regionale Weine."

### 2. Restaurantbesuch mit Wein-Erinnerung

Ein starkes Feature nach MVP:

- Nutzer markiert "Ich war hier".
- Scan eines Weins wird mit Restaurant verknüpft.
- Später: "Den Chardonnay hast du im Restaurant X getrunken."

Das ist einzigartiger als eine normale Restaurantbewertung.

### 3. Weniger, bessere Vorschläge

Google liefert oft lange Listen. Wine Scanner sollte kuratieren:

- Karte plus Top-Liste statt endlosem Feed.
- Klare Badges.
- "Heute passend" statt "alles in der Nähe".

### 4. Vertrauen durch Transparenz

Die App sollte Datenquellen klar anzeigen:

- Google/Foursquare Bewertung.
- Wine-Scanner eigene Bewertung.
- Daten zuletzt aktualisiert.
- Restaurant gespeichert oder besucht.

## Produktprinzipien

1. Wine-first, nicht map-first.
2. Wenige gute Optionen sind besser als 100 Treffer.
3. Standort ist hilfreich, aber freiwillig.
4. Externe Bewertungen sind Signal, nicht Wahrheit.
5. Jeder Restaurantbesuch kann später eine Wein-Erinnerung werden.

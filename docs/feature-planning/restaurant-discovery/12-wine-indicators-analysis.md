# Restaurant-Discovery: Wine-Indikatoren Analyse

Stand: 2026-05-02

## Kurzfazit

Wine-Indikatoren sind im aktuellen Restaurant-Discovery-Stand nicht sichtbar modelliert. Es gibt keinen Substring-Match auf `Wein`, `Sommelier`, `Weinkarte`, `Weinauswahl`, `Vinothek` oder `Weingut`. Der einzige Weinbezug in der normalen Suche ist indirekt: `wine_bar` zählt in der Smart-Quality-Logik als eine von mehreren klaren Küchenrichtungen und gibt maximal 4 Quality-Punkte.

Die neue Logik sollte deshalb transient in den Edge Functions berechnet und als optionales `wineProfile` an die App ausgeliefert werden. Keine Migration ist nötig, weil das Profil aus vorhandenen Google-Places-Daten, Reviews, Name, Cuisine und Types abgeleitet wird.

## Ist-Stand der Wein-Logik

- `search-restaurants` berechnet `qualityScore`, `qualityLabel` und `qualitySignals` serverseitig.
- Der Weinbezug steckt nur in `typeScore`: `wine_bar` steht neben `fine_dining_restaurant`, `italian_restaurant` und `mediterranean_restaurant`.
- `typeScore` ist generisch und wird als `Klare Küchenrichtung` angezeigt, nicht als Wein-Signal.
- Review-Texte werden in der normalen Suche bisher nicht angefordert. Die KI-Empfehlung lädt dagegen Place Details mit `reviews`, `reviewSummary` und `servesWine`.
- Es gibt keine Persistenz für Wein-Indikatoren in `restaurants`; `source_payload` wird nicht als App-Datenmodell genutzt.

## Datenfluss

```text
Google Nearby Search
  -> search-restaurants Edge Function
  -> Google Places Normalisierung
  -> Quality-Score-Berechnung
  -> WineProfile-Berechnung aus Name, Types, Cuisine, servesWine, Reviews
  -> RestaurantRecord[]
  -> src/lib/restaurants.ts normalizeRestaurant
  -> useRestaurantSearch
  -> DiscoverScreen Karte und Liste
  -> RestaurantCard, RestaurantPreview, Marker
```

Cached Searches laufen über denselben Response-Mapping-Pfad. Da Review-Texte nicht persistiert werden, bekommen cached Rows ein reduziertes Profil aus Name, Types und Cuisine.

## Integrationspunkte

- `supabase/functions/_shared/wine-profile.ts`: pure Erkennung und Score-Berechnung, damit Search und Detail dieselbe Logik nutzen.
- `supabase/functions/search-restaurants/index.ts`: Field Mask um `places.reviews` und `places.servesWine` erweitern, Profile aus frischen Places berechnen, cached Rows reduziert bewerten.
- `supabase/functions/restaurant-detail/index.ts`: Detail-Refresh ebenfalls mit `reviews` und `servesWine`, damit die Detaildaten konsistent bleiben.
- `src/types/restaurant.ts`: `WineProfile`, `WineProfileBadge` und optionales `RestaurantRecord.wineProfile`.
- `src/lib/restaurants.ts`: defensive Normalisierung für alte Records ohne `wineProfile`.
- `app/(app)/discover.tsx`: Badge unter der Titelzeile der RestaurantCard, Full-Wine-Profiles als dezentes Wein-Icon im Marker.

## Wiederverwendbare UI-Patterns

- Pills/Badges folgen bestehenden Patterns aus `ConfidenceBadge`, `AromaPills`, `ratingPill`, `qualityInline` und `filterChoice`.
- Icons kommen weiter aus `Ionicons`; für Wein wird `wine-outline` genutzt.
- Der Discover-Screen ist aktuell noch monolithisch. Die neue `WineIndicatorBadge` liegt bewusst unter `src/components/discover/`, kann später zusammen mit RestaurantCard/Marker ausgelagert werden.

## Theme-Tokens

- Akzent: `colors.primary`, `colors.primaryDark`
- Flächen: `colors.surface`, `colors.surfaceWarm`
- Linien: `colors.border`
- Subtext: `colors.textSecondary`, `colors.placeholder`
- Kontrast: `colors.white`
- Spacing und Rundungen: `spacing.xs`, `spacing.sm`, `radii.pill`

Es werden keine Inline-Hex-Farben ergänzt. Light/Dark Mode läuft vollständig über `useTheme()`.

## Worktree-Hinweis

Der Worktree war vor dieser Umsetzung bereits dirty, auch in Restaurant-Discovery-Dateien. Die Implementierung arbeitet auf dem vorhandenen Stand weiter und dreht keine fremden Änderungen zurück.

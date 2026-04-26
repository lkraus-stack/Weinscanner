# Sprint 15 Bundle Audit

## Export

| Feld | Wert |
| --- | --- |
| Befehl | `npx expo export --platform ios --dump-assetmap --output-dir /tmp/wine-scanner-export` |
| Plattform | iOS |
| Format | Hermes Bytecode (`.hbc`) |
| Bundle vor Quick-Win | 5.30 MB |
| Asset-Summe vor Quick-Win | 3.91 MB |
| Asset-Anzahl vor Quick-Win | 31 |

Der Expo-Hermes-Export liefert Bundle-Datei und Assetmap, aber keine belastbare per-Modul-JS-Aufschluesselung. Die Top-10 unten sind daher die messbaren Asset-Beitraege aus `assetmap.json`.

## Top-10 Assets Vor Quick-Win

| Rang | Asset | Groesse |
| ---: | --- | ---: |
| 1 | MaterialCommunityIcons.ttf | 1277.0 KB |
| 2 | FontAwesome6_Solid.ttf | 413.7 KB |
| 3 | Ionicons.ttf | 380.6 KB |
| 4 | MaterialIcons.ttf | 348.5 KB |
| 5 | Fontisto.ttf | 306.2 KB |
| 6 | FontAwesome6_Brands.ttf | 204.5 KB |
| 7 | FontAwesome5_Solid.ttf | 198.0 KB |
| 8 | FontAwesome.ttf | 161.7 KB |
| 9 | FontAwesome5_Brands.ttf | 130.9 KB |
| 10 | AntDesign.ttf | 127.4 KB |

## Quick-Win

Die App nutzt ausschliesslich Ionicons. Die Barrel-Imports aus `@expo/vector-icons` haben aber alle Vector-Icon-Fonts in den Export gezogen. Nach Umstellung auf direkte Imports aus `@expo/vector-icons/Ionicons` wurde erneut exportiert:

| Feld | Vorher | Nachher | Delta |
| --- | ---: | ---: | ---: |
| iOS Hermes Bundle | 5.30 MB | 4.98 MB | -0.32 MB |
| Asset-Summe | 3.91 MB | 0.40 MB | -3.51 MB |
| Asset-Anzahl | 31 | 13 | -18 |
| Metro-Module | 1678 | 1624 | -54 |

## Top Assets Nach Quick-Win

| Rang | Asset | Groesse |
| ---: | --- | ---: |
| 1 | Ionicons.ttf | 380.6 KB |
| 2 | expo-router arrow_down.png | 9.2 KB |
| 3 | expo-router unmatched.png | 4.6 KB |
| 4 | React Navigation clear-icon.png | 2.3 KB |
| 5 | React Navigation search-icon.png | 2.3 KB |
| 6 | React Navigation back-icon.png | 2.2 KB |
| 7 | React Navigation close-icon.png | 1.2 KB |
| 8 | React Navigation back-icon-mask.png | 0.6 KB |
| 9 | expo-router error.png | 0.5 KB |
| 10 | expo-router sitemap.png | 0.5 KB |

## Dependency Check

`npx depcheck --json` meldete als potenziell ungenutzt: `expo-crypto`, `expo-status-bar`, `sentry-expo`, `supabase`, `typescript`.

Bewertung:

- `sentry-expo` ist ein echter Cleanup-Kandidat, weil die App inzwischen `@sentry/react-native` nutzt.
- `expo-crypto` und `expo-status-bar` koennen entfernt werden, wenn sie in den naechsten Sprints nicht wieder gebraucht werden.
- `supabase` und `typescript` bleiben trotz depcheck-Meldung im Projekt, weil sie CLI beziehungsweise Toolchain pinnen.

## Backlog

- Per-Modul-JS-Analyse spaeter mit einem Metro-/Hermes-kompatiblen Analyzer nachziehen, falls App-Start-Zeit regrediert.
- Unused-Dependency-Cleanup getrennt durchfuehren, damit Bundle- und Package-Diffs nicht vermischt werden.

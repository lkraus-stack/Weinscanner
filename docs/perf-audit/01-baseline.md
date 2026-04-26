# Sprint 15 Performance Baseline

## Metadaten

| Feld | Wert |
| --- | --- |
| Datum | 2026-04-25 |
| Baseline-Commit | `901913f` |
| Worktree vor Report | sauber |
| Geraet | nicht gemessen |
| Expo Go Version | nicht gemessen |
| Netzwerk | nicht gemessen |
| Build-Modus | Expo Go, geplant fuer manuelle Messung |
| Scope | Audit-Report, keine App-Code-Aenderungen |

## Zielwerte und Messmethode

| Ziel | Target | Baseline |
| --- | ---: | --- |
| App-Start bis erstem Screen | < 2 s auf iPhone 12 | nicht gemessen |
| Tab-Wechsel | < 100 ms | nicht gemessen |
| Verlauf-Liste mit 200 Eintraegen | konstante 60 fps | nicht gemessen |
| Scan-Capture bis Confirmation, Fresh | < 8 s | nicht gemessen |
| Scan-Capture bis Confirmation, Cache-Hit | < 2 s | nicht gemessen |

Manuelle Messung fuer die naechste Review: iOS-Screen-Recording starten, Szenario dreimal ausfuehren, Zeitstempel aus dem Video ablesen und den Median eintragen. Fuer Listen-Scroll zusaetzlich den React Native Performance Monitor nutzen, falls in Expo Go verfuegbar.

## Listen-Audit

| Screen | Liste | FlashList | estimatedItemSize | Item memoisiert | Bild-Caching | Callback-Stabilitaet | Key |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Verlauf | `app/(app)/index.tsx` | ja | fehlt | nein, `HistoryItem` ist plain function | ja, `expo-image` mit `memory-disk` | groesstenteils `useCallback`, aber Query-Objekt in Dependencies | `item.id` |
| Bewertet | `app/(app)/ratings.tsx` | ja | fehlt | nein, `RatingItem` ist plain function | ja, `expo-image` mit `memory-disk` | groesstenteils `useCallback`, aber Query-Objekt in Dependencies | `item.id` |
| Bestand | `app/(app)/inventory.tsx` | ja | fehlt | nein, `InventoryItem` ist plain function | ja, `expo-image` mit `memory-disk` | groesstenteils `useCallback`, aber Query-Objekt in Dependencies | `item.id` |

Hotspots:

1. `estimatedItemSize` fehlt in allen drei Hauptlisten. Das erschwert Virtualisierung und Layout-Vorhersage.
2. Die drei Item-Komponenten sind nicht mit `React.memo` geschuetzt. Parent-State, Filter oder Mutationsstatus koennen dadurch mehr Items neu rendern als noetig.
3. `HistoryItem` nutzt fuer den Farbswatch einen dynamischen Inline-Style. Klein, aber in langen Listen messbar.
4. `loadMore` und einige Empty-State Callbacks haengen an ganzen Query-Objekten. Besser einzelne stabile Properties extrahieren.

Empfohlene Schritt-2-Aktionen:

- Realistische Item-Hoehen messen: Verlauf ca. 132 bis 148 px, Bewertet ca. 124 bis 142 px, Bestand ca. 150 bis 172 px. Danach `estimatedItemSize` setzen und gegen Scroll-Verhalten messen.
- `HistoryItem`, `RatingItem`, `InventoryItem` mit `React.memo` wrappen.
- Dynamische Item-Styles reduzieren oder isolieren.
- Callback-Dependencies auf primitive Query-Properties reduzieren.

## Query-Audit

| Query | Hook | staleTime | Datenquelle | Signed URLs | Befund |
| --- | --- | ---: | --- | --- | --- |
| `history` | `useHistory` | 30 s | RPC `get_user_scan_history` | gebatcht via `createSignedUrls` | Gute Basis, aber Liste wird bei Rating-Aenderungen komplett invalidiert |
| `ratings` | `useRatings` | 30 s | Supabase Join `ratings -> vintages -> wines` | gebatcht via `createSignedUrls` | Gute Basis, Sort und Filter im Query |
| `inventory` | `useInventory` | 30 s | Supabase Join plus extra Scan-Foto-Query | gebatcht via `createSignedUrls` | Extra Roundtrip pro Page fuer neuestes Scan-Foto |
| `scan-detail` | `useScanDetail` | 60 s | Supabase Join | gebatcht via `createSignedUrls` | Zielwert passt |
| `profile` | `useProfile` | 60 s | Supabase `profiles` | einzeln fuer Avatar | Zielwert spaeter 5 min |
| `user-stats` | `useUserStats` | 60 s | RPC `user_stats` | keine | Zielwert passt |
| `inventory-stats` | `useInventoryStats` | 30 s | Supabase `inventory_items` | keine | Zielwert spaeter 60 s |

Hotspots:

1. `useInventory` fuehrt pro Page eine zusaetzliche `scans` Query aus, um das neueste Foto pro Jahrgang zu finden. Fuer 200 Eintraege sind das zehn zusaetzliche Roundtrips bei Page-Size 20.
2. Rating- und Inventory-Mutationen invalidieren teils ganze Listen. Das ist korrekt, aber fuer Schritt 3 sollte gemessen werden, ob Detail-Updates und gezielte Query-Updates reichen.
3. `useProfile` ist stabiler als 60 Sekunden. Ein Zielwert von 5 Minuten reduziert Profil-Refetches beim Tab-Wechsel.
4. `useInventoryStats` aggregiert clientseitig alle Inventory-Zeilen. Bei grossem Bestand koennte eine RPC effizienter sein.

Empfohlene Schritt-3-Aktionen:

- Gemeinsame Storage-Hilfe `batchSignedUrls(paths, expiresIn)` in `src/lib/storage.ts` anlegen, damit die Batching-Logik nicht dreimal dupliziert ist.
- `useInventory` mittelfristig auf RPC erweitern, die Inventory-Daten plus neuestes Scan-Foto in einem Roundtrip liefert.
- `staleTime` fuer `profile` auf 5 Minuten und `inventory-stats` auf 60 Sekunden setzen.
- Query-Invalidierungen nach Messung praezisieren.

## Render-Audit

Vermutete Re-Render-Hotspots ohne Code-Instrumentierung:

- Verlauf: `rows` wird aus allen Pages neu aufgebaut, sobald History-Daten oder Filter wechseln. Das ist korrekt, aber Item-Memoisierung fehlt.
- Bewertet: Sort- und Sternfilter fuehren zu neuen Query-Keys und neuem Listenarray. Item-Memoisierung fehlt.
- Bestand: Preferences werden im Inventory-Screen gelesen. Aenderungen an Profil-Preferences koennen die Bestandsliste refetchen, gewollt fuer `hide_empty_inventory`, aber fuer andere Preferences nicht relevant.
- Profile: `profile.tsx` ist bewusst kein 50+ Item Screen, daher kein FlashList-Bedarf.
- Temporare Render-Logs wurden nicht eingebaut, damit Schritt 1 keine App-Code-Aenderungen enthaelt.

Messvorschlag:

- In Schritt 2 kurzzeitig React DevTools Profiler oder gezielte Dev-only Logs lokal verwenden, danach entfernen.
- Besonders messen: Tab-Wechsel zu Verlauf, Rating speichern aus Verlauf, Inventory decrement.

## Bundle- und App-Start-Audit

Statisch geprueft:

- Keine Imports oder Dependencies fuer lodash, moment, dayjs oder date-fns gefunden.
- Relevante Bundle-Beitraege sind wahrscheinlich `@expo/vector-icons`, `expo-image-picker`, `expo-image-manipulator`, Sentry und Supabase.
- Root-Start wartet in `app/_layout.tsx` auf `useAuth()`, dort auf `supabase.auth.getSession()`. Erst danach wird Splash versteckt und Routing entschieden.
- `QueryClient` wird stabil per `useState` erzeugt.

Hotspots:

1. App-Start-Zeit muss getrennt gemessen werden fuer kalten Start mit bestehender Session und ohne Session.
2. `@expo/vector-icons` wird breit ueber `Ionicons` genutzt. Optimierung nur nach Bundle-Report in Schritt 4.
3. Sentry init passiert sehr frueh, korrekt fuer Crash-Reporting, aber als App-Start-Beitrag im Bundle-Report dokumentieren.

Empfohlene Schritt-4-Aktionen:

- `npx expo export --dump-assetmap` ausfuehren und `docs/perf-audit/02-bundle.md` erstellen.
- Bundle-Groesse vor und nach moeglichen Import-Optimierungen vergleichen.
- `getSession` Latenz mit Zeitmarken messen, ohne Production-Logs im Code zu lassen.

## Netzwerk-Audit

Scan-Flow:

1. Kamera oder Galerie liefert lokale Datei.
2. `scan-review` komprimiert und uploaded Bild in `wine-labels`.
3. `scan-confirm` ruft `scan-wine` Edge Function auf.
4. Edge Function orchestriert Minimal-Extraction, Cache-Suche und bei Bedarf Full-Extraction.
5. Confirmation speichert spaeter ueber `save-scan`.

Baseline-Befund:

- Cache-Hit und Fresh-Pfad muessen getrennt gemessen werden.
- Client ruft KI nicht direkt auf, Pflichtregel eingehalten.
- `src/lib/ai-client.ts` hat Retry-Logik fuer Analysefunktionen. Gut fuer Robustheit, aber Worst-Case kann Fresh-Latenz erhoehen.
- Signed URLs in Listen werden bereits pro Page gebatcht. Avatar nutzt einzelne Signed URL, unkritisch.

## Priorisierte Action-Items

| Prioritaet | Hotspot | Schritt | Erwarteter Impact | Messung |
| --- | --- | --- | --- | --- |
| P1 | `estimatedItemSize` fehlt in drei FlashLists | Schritt 2 | Stabileres Scrollen, weniger Layout-Arbeit | Scroll FPS und subjektiver Jank vor/nach |
| P1 | List-Items nicht memoisiert | Schritt 2 | Weniger Re-Renders bei Filter, Rating, Inventory-Aktionen | React Profiler oder Dev-only Render-Zaehler |
| P1 | Harte Laufzeitwerte fehlen | Schritt 1 Review | Baseline erst vollstaendig messbar | Expo-Go Screen-Recording, 3 Laeufe |
| P2 | Inventory extra Roundtrip fuer Scan-Fotos | Schritt 3 | Weniger Netzwerk pro Page | Network-Logs und Query-Zeit |
| P2 | `profile` staleTime nur 60 s | Schritt 3 | Weniger Refetch beim Profil-Tab | React Query Devtools oder Network-Logs |
| P2 | `inventory-stats` staleTime nur 30 s und Client-Aggregation | Schritt 3 | Weniger Refetch und Client-Arbeit | Query-Zeit und Tabellenumfang |
| P3 | Bundle-Beitraege unbekannt | Schritt 4 | App-Start-Optimierung zielgerichtet | `expo export --dump-assetmap` |

## Manuelle Messfelder fuer Review

| Szenario | Lauf 1 | Lauf 2 | Lauf 3 | Median | Notiz |
| --- | --- | --- | --- | --- | --- |
| App-Start mit Session | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen | Gefuehlt schnell, kein spuerbarer Haenger. Sprint 15 fokussiert auf Code-Hotspots aus statischer Analyse und subjektiven iPhone-Smoke-Tests. Harte Lab-Werte sind nicht im Scope dieses Sprints. |
| App-Start ohne Session | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen | Nicht separat gemessen. Sprint 15 fokussiert auf Code-Hotspots aus statischer Analyse und subjektiven iPhone-Smoke-Tests. Harte Lab-Werte sind nicht im Scope dieses Sprints. |
| Tab-Wechsel Verlauf -> Bestand | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen | Subjektiv instant. Sprint 15 fokussiert auf Code-Hotspots aus statischer Analyse und subjektiven iPhone-Smoke-Tests. Harte Lab-Werte sind nicht im Scope dieses Sprints. |
| Tab-Wechsel Bestand -> Bewertet | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen | Subjektiv instant. Sprint 15 fokussiert auf Code-Hotspots aus statischer Analyse und subjektiven iPhone-Smoke-Tests. Harte Lab-Werte sind nicht im Scope dieses Sprints. |
| Tab-Wechsel Bewertet -> Profil | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen | Subjektiv instant. Sprint 15 fokussiert auf Code-Hotspots aus statischer Analyse und subjektiven iPhone-Smoke-Tests. Harte Lab-Werte sind nicht im Scope dieses Sprints. |
| Verlauf Scroll 50+ Eintraege | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen | Kein subjektiver Jank, aber bei nur wenigen Scans nicht aussagekraeftig. Sprint 15 fokussiert auf Code-Hotspots aus statischer Analyse und subjektiven iPhone-Smoke-Tests. Harte Lab-Werte sind nicht im Scope dieses Sprints. |
| Verlauf Scroll 200 Eintraege | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen | Nicht aussagekraeftig, benoetigt Testdaten. Sprint 15 fokussiert auf Code-Hotspots aus statischer Analyse und subjektiven iPhone-Smoke-Tests. Harte Lab-Werte sind nicht im Scope dieses Sprints. |
| Scan Fresh bis Confirmation | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen | Subjektiv ca. 10 Sekunden inklusive Upload und KI-Analyse. Sprint 15 fokussiert auf Code-Hotspots aus statischer Analyse und subjektiven iPhone-Smoke-Tests. Harte Lab-Werte sind nicht im Scope dieses Sprints. |
| Scan Cache-Hit bis Confirmation | nicht gemessen | nicht gemessen | nicht gemessen | nicht gemessen | Nicht systematisch verglichen. Sprint 15 fokussiert auf Code-Hotspots aus statischer Analyse und subjektiven iPhone-Smoke-Tests. Harte Lab-Werte sind nicht im Scope dieses Sprints. |

## Pausepunkt

Schritt 1 ist mit diesem Report inhaltlich abgeschlossen. Vor Schritt 2 sollten die manuellen Expo-Go-Messwerte nachgetragen oder bewusst als nicht verfuegbar akzeptiert werden.

# Sprint 15 Performance Improvements

## Block A, P1 Listen-Optimierungen

| Aenderung | Status | Vorher | Nachher | Test |
| --- | --- | --- | --- | --- |
| `estimatedItemSize` fuer FlashList | nicht angewendet | Audit-Annahme aus FlashList v1, Prop fehlte laut TypeScript | FlashList 2.0.2 nutzt diesen Prop nicht mehr, kein `any`-Hack eingebaut | `npx tsc --noEmit` hatte den Prop korrekt abgelehnt |
| List-Items memoisiert | umgesetzt | `HistoryItem`, `RatingItem`, `InventoryItem` waren plain functions | Alle drei Komponenten sind mit `React.memo` exportiert | `npx tsc --noEmit` gruen, `npx expo lint` gruen |
| Weinfarben-Swatch vorbereitet | umgesetzt | `HistoryItem` erzeugte pro Render ein dynamisches Inline-Style-Objekt | Swatch-Farben liegen als `StyleSheet`-Lookup am File-Top | `npx tsc --noEmit` gruen, `npx expo lint` gruen |

## Subjektiver Vergleich

| Szenario | Vorher | Nachher | Notiz |
| --- | --- | --- | --- |
| Verlauf Scroll | kein subjektiver Jank bei wenigen Scans | noch nicht manuell nachgemessen | iPhone-Smoke-Test nach Block B nachholen |
| Bewertet Scroll | nicht hart gemessen | noch nicht manuell nachgemessen | Memoisierung reduziert unnoetige Re-Renders bei Parent-State-Aenderungen |
| Bestand Scroll | nicht hart gemessen | noch nicht manuell nachgemessen | Memoisierung reduziert unnoetige Re-Renders bei Mutationsstatus-Aenderungen |

## Offene Punkte

- Harte iPhone-Lab-Werte bleiben fuer Sprint 15 bewusst ausser Scope.
- `estimatedItemSize` wird nicht weiter verfolgt, solange `@shopify/flash-list` 2.x eingesetzt wird.

## Block B, P2 Query-Optimierungen

| Aenderung | Status | Vorher | Nachher | Test |
| --- | --- | --- | --- | --- |
| Profil-Cache | umgesetzt | `useProfile` wurde nach 60 Sekunden stale | `useProfile` bleibt 5 Minuten frisch, Mutations-Invalidierung bleibt massgeblich | `npx tsc --noEmit` gruen, `npx expo lint` gruen |
| Bestandsstatistik-Cache | umgesetzt | `useInventoryStats` wurde nach 30 Sekunden stale | `useInventoryStats` bleibt 60 Sekunden frisch, Mutations-Invalidierung bleibt massgeblich | `npx tsc --noEmit` gruen, `npx expo lint` gruen |
| Signed-URL-Batching | umgesetzt | History, Ratings und Inventory hielten eigene Batching-Logik | Gemeinsamer `batchSignedUrls` Helper in `src/lib/storage.ts` | `npx tsc --noEmit` gruen, `npx expo lint` gruen |
| Inventory-Foto-Roundtrip | umgesetzt | `useInventory` lud Bestand und danach Scans separat pro Page | RPC `get_user_inventory_with_photos` liefert Bestand plus neuestes Scan-Foto in einem Query | Migration gepusht, Types generiert, `npx tsc --noEmit` gruen, `npx expo lint` gruen |

## Block B subjektiver Vergleich

| Szenario | Vorher | Nachher | Notiz |
| --- | --- | --- | --- |
| Profil-Tab erneut oeffnen | Refetch nach 60 Sekunden moeglich | Refetch erst nach 5 Minuten, ausser nach Mutation | Manueller iPhone-Test noch offen |
| Bestand-Tab mit Bildern | Ein extra Scans-Query pro Page | Ein RPC-Query plus ein Signed-URL-Batch | Manueller iPhone-Test noch offen |
| Listenbilder | Batching mehrfach implementiert | Ein gemeinsamer Helper, gleiches Verhalten fuer Remote-URLs und Storage-Pfade | Network-Inspector-Verifikation noch offen |

## Block C, Bundle-Audit

| Aenderung | Status | Vorher | Nachher | Test |
| --- | --- | --- | --- | --- |
| Bundle-Audit | umgesetzt | Keine Export-Baseline fuer iOS-Hermes-Bundle | `02-bundle.md` dokumentiert Bundle, Assetmap und Top-Assets | `npx expo export --platform ios --dump-assetmap` erfolgreich |
| Icon-Import Quick-Win | umgesetzt | Barrel-Import aus `@expo/vector-icons` zog alle Icon-Fonts in den Export | Direkter `@expo/vector-icons/Ionicons` Import zieht nur Ionicons | Export erneut erfolgreich, Asset-Summe von 3.91 MB auf 0.40 MB reduziert |

## Block C subjektiver Vergleich

| Szenario | Vorher | Nachher | Notiz |
| --- | --- | --- | --- |
| iOS Hermes Bundle | 5.30 MB | 4.98 MB | Quick-Win durch direkte Ionicons-Imports |
| Exportierte Assets | 3.91 MB | 0.40 MB | Nicht genutzte Icon-Fonts entfernt |
| Metro-Module | 1678 | 1624 | Export-Messung, kein Runtime-iPhone-Wert |

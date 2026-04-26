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

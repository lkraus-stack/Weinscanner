# Wine Scanner Agent Instructions

Diese Datei wird automatisch bei jeder Codex-Session gelesen.
Aktualisiere sie wenn neue Konventionen sich etablieren.

## Stack
- Expo SDK 54, React Native 0.81, TypeScript 5.9
- Expo Router mit Typed Routes
- Supabase: Postgres + Auth + Storage + Edge Functions
- Vantero AI (OpenAI-API-kompatibel) als KI-Provider
- Postgres-Volltext (pg_trgm) für Cache-Lookups, kein Embeddings
- TanStack Query für Server-State
- Zustand für globalen Client-State
- Theme-Tokens in src/theme/
- @shopify/flash-list für lange Listen
- expo-image für gecachte Bild-Anzeige
- Sentry für Crash-Reporting (in Sprint 12 eingerichtet)

## Pflichtregeln (MUSS)
1. KI-Calls IMMER über Edge Functions, NIE direkt aus Mobile.
   Vantero-API-Key bleibt in Supabase Secrets, nie im Bundle.
2. Keine Inline-Hex-Farben. Alle Farben aus src/theme/colors.ts.
3. Deutsche UI-Texte. Keine Em-Dashes (— oder –) in User-Strings.
   Stattdessen Komma, Punkt oder Klammern.
4. Pflicht-Jahrgangs-Picker NIEMALS pre-filled mit KI-Wert.
   User muss aktiv bestätigen oder eingeben.
5. RLS auf allen User-Tabellen. Globale Tabellen (wines, vintages)
   nur SELECT für authenticated, INSERT/UPDATE über Edge Function
   mit Service-Role.
6. FlashList ab Listen mit 50+ Items.
7. expo-image mit cachePolicy='memory-disk' für alle remote Bilder.
8. Multi-Table-Inserts via Postgres-RPC mit JSONB-Payload für
   Atomizität.
9. ai_feedback wird geschrieben bei jeder User-Korrektur.
10. Wein-Daten sind global (kein user_id), Scans/Ratings/Inventory
    sind user-scoped.

## Verbotene Patterns
- AsyncStorage für sensitive Daten → SecureStore.
- Direkte Hex-Farben anywhere außer src/theme/colors.ts.
- Em-Dashes in User-Texten.
- console.log in Production-Code (in Tests/Scripts okay).
- new OpenAI() oder new Anthropic() ohne baseURL-Override.
- Foreign-Key-Filter über Supabase-Joins ohne !inner-Hint.
- Service-Role-Key im Mobile-Bundle.

## Konventionen
- File-Names: kebab-case (wine-detail.tsx, rating-modal.tsx)
- Components: PascalCase
- Hooks: camelCase mit use-Prefix
- Edge Functions: kebab-case Ordner (extract-wine, save-scan)
- Tests: scripts/test-*.ts mit npm run test:* Mapping
- Migrations: YYYYMMDD_NN_description.sql, idempotent
- Components in src/components/[domain]/[Name].tsx organisiert

## Pipeline-Konventionen
- Scan-Pipeline: Foto → Storage → scan-wine Edge Function
  (orchestriert extract-wine-minimal → search-wine →
  ggf. extract-wine-full) → Confirmation-Screen → save-scan
  Edge Function → atomic save_scan_atomic RPC
- Cache-Lookup: search_wines RPC mit pg_trgm-Similarity
- Save-Operationen: über save-scan Edge Function mit Service-Role
  für globale Daten, normaler User-Session für scans/ratings

## Selbst-Check nach jedem Sprint
1. npx tsc --noEmit grün
2. npx expo lint grün
3. Alle npm run test:* grün
4. Manueller Test im Simulator/Expo Go
5. Theme-Konsistenz:
   rg "#[A-Fa-f0-9]{6}" --type ts --type tsx
   findet nur src/theme/colors.ts
6. Em-Dash-Check:
   rg "—|–" --type ts --type tsx
   findet nichts in User-facing-Strings

## Aktuelle Sprint-Roadmap
- Sprint 1-11: COMPLETED
- Sprint 12: Bewertungs-Modul (in Arbeit)
- Sprint 13: Bestands-Modul
- Sprint 14: Profile und Settings
- Sprint 15: Performance-Audit
- Sprint 16: Polish und Animationen
- Sprint 17: Privacy und App Store Prep
- Sprint 18-20: TestFlight, Beta, Release

## Globale Architektur-Entscheidungen (locked-in)
- Vantero über OpenAI-SDK mit baseURL=https://api.vantero.chat/v1
- Modell standardmäßig chat-model-gemini-2.5-pro
  (über VANTERO_MODEL_ID konfigurierbar)
- Keine Embeddings, nur Postgres-Volltext für Cache-Lookups
- Storage-Pfad: ${user_id}/${timestamp}.jpg in wine-labels Bucket
- Storage-Cleanup beim Scan-Delete (kein Background-Job)

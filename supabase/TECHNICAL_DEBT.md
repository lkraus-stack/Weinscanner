# Supabase Technical Debt

1. `wines.updated_at` Trigger nachziehen, sobald Schreibzugriffe über Edge Functions kommen (Sprint 06+).
2. Storage UPDATE/DELETE Policies in Sprint 14 ergänzen.
3. Storage-Cleanup-Trigger bei Scan-Löschung in Sprint 12 ergänzen oder alternativ als Edge Function Cleanup-Job umsetzen.

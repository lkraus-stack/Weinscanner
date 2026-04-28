# Wine Scanner Self-Audit
## Datum: 2026-04-26

## Executive Summary
- Total Findings: 18
- Severity-Verteilung: 1 critical, 6 high, 8 medium, 3 low
- Empfohlene Reihenfolge: Auth/Datenschutz-Caches, Magic-Link/PKCE, Supabase-Session-Stabilität, Profile-Fallback, Scan-Test-Isolation, Expo-Patch-Mismatches, danach UX- und Coverage-Lücken.
- Aktualisiert am 2026-04-28: Sprint-19-Launch-Blocker C-01, H-01 bis H-05 sowie M-01 und M-05 sind umgesetzt und lokal verifiziert.

## Automatisierte Checks

### TypeScript
```text
$ npx tsc --noEmit
PASS
```

### Lint
```text
$ npx expo lint
PASS
```

### Tests
```text
$ npm run test:storage
PASS

$ npm run test:save-scan
PASS

$ npm run test:history
PASS

$ npm run test:scan-wine
Initial FAIL vor Sprint-19-Fix:
Key (id)=(60373523-a167-4541-9c41-9fbc1d7a41e7) is still referenced from table "scans".
update or delete on table "vintages" violates foreign key constraint "scans_vintage_id_fkey"

Nach Sprint-19-Fix:
PASS

$ npm run test:extract-wine
PASS
```

### Konventions-Checks
```text
$ rg "console\.log" app src
PASS

$ rg "—|–" app src
PASS

$ rg "from '@/theme/colors'" app src -g '!src/theme/**'
PASS

$ rg "#[A-Fa-f0-9]{6}" app src -g '!src/theme/colors.ts'
PASS

$ rg "TODO|FIXME|HACK|XXX" app src
PASS
```

### Dependency Health
```text
$ npx expo-doctor
Initial: 16/17 checks passed

Patch-Mismatches:
- expo expected ~54.0.34, found 54.0.33
- expo-crypto expected ~15.0.9, found 15.0.8
- expo-file-system expected ~19.0.22, found 19.0.21
- expo-image-picker expected ~17.0.11, found 17.0.10
- expo-linking expected ~8.0.12, found 8.0.11
- expo-updates expected ~29.0.17, found 29.0.16

Nach Sprint-19-Fix:
17/17 checks passed. No issues detected.

$ npm audit
17 moderate severity vulnerabilities
No high or critical vulnerabilities reported.

$ npm outdated
Mehrere Latest-Versionen zeigen bereits SDK-55-Stände. Für Sprint 19 relevant sind nur die Expo-SDK-54-Patch-Mismatches aus expo-doctor.
```

### Bundle Snapshot
```text
$ npx expo export --platform ios --output-dir /tmp/audit-bundle
iOS Bundled 9425ms
2147 modules

$ du -sh /tmp/audit-bundle
6.9M /tmp/audit-bundle

$ ls -lh /tmp/audit-bundle/
assets 488K
_expo  6.4M
```

## Findings nach Severity

### Critical
| ID | Bereich | Finding | Empfehlung | Sprint-19-Status |
|----|---------|---------|------------|------------------|
| C-01 | Datenschutz/Auth | Userbezogene React-Query-Caches sind nicht überall mit `user.id` gescoped. Nach Logout/Login mit anderem User können alte History-, Rating-, Inventory- oder Detaildaten kurz sichtbar bleiben. | Query-Keys user-scopen und QueryClient bei Logout, Account-Löschung und User-Wechsel leeren. | Fixed |

### High
| ID | Bereich | Finding | Empfehlung | Sprint-19-Status |
|----|---------|---------|------------|------------------|
| H-01 | Auth | Magic-Link-Callback verarbeitet nur `access_token`/`refresh_token`, aber nicht den Supabase-PKCE-Flow mit `?code=`. Das erklärt den TestFlight-Fehler "Unmatched Route" nach Magic-Link. | `exchangeCodeForSession(code)` ergänzen und Callback-Route als echte Zwischenroute stabil halten. | Fixed |
| H-02 | Auth | Supabase RN Client nutzt noch keinen `processLock` und keine AppState-gesteuerte Auto-Refresh-Steuerung. | Offizielle Supabase-RN-Empfehlung ergänzen. | Fixed |
| H-03 | Profil | Wenn der `handle_new_user`-Trigger fehlschlägt oder Apple keine sichtbare E-Mail liefert, fehlt ein sicherer App-Fallback für Profile. | RPC `ensure_profile()` plus App-Fallback in `getProfile()` ergänzen. | Fixed |
| H-04 | Tests | `test:scan-wine` löscht globale Weine per Namensmuster und kann echte referenzierte Daten treffen. | Cleanup opt-in machen und FK-Fehler beim Test-Cleanup nicht als Testfehler werten. | Fixed |
| H-05 | Dependencies | Expo-SDK-54-Patch-Mismatches führen zu rotem expo-doctor und erhöhen Build-Risiko. | Kompatible Patch-Versionen per `expo install` aktualisieren. | Fixed |
| H-06 | Datenintegrität | `save_scan_atomic` ist direkt aufrufbar und schreibt Wine-/Vintage-Daten aus Client-Payload. RLS schützt Userdaten, aber globale Wine-Daten bleiben ein Datenqualitätsrisiko. | Vor Launch akzeptabel mit Edge-Function-Pfad, mittelfristig RPC härten oder Payload stärker validieren. | Offen |

### Medium
| ID | Bereich | Finding | Empfehlung | Sprint-19-Status |
|----|---------|---------|------------|------------------|
| M-01 | Scan | `scan-confirm` setzt `isLoading` im `finally` auch für veraltete Analyse-Runs zurück. | Run-ID auch im `finally` prüfen. | Fixed |
| M-02 | Scan | Abgebrochene Scans können Storage-Orphans erzeugen. | Label-Datei beim Verwerfen oder Analyseabbruch entfernen. | Offen |
| M-03 | Scan | Bild-Preflight für sehr große/ungewöhnliche Formate ist noch schwach dokumentiert. | Größen-/Formatgrenzen im Client expliziter behandeln. | Offen |
| M-04 | Export | Export lädt potenziell unpaginiert wachsende Userdaten. | Vor Launch bei kleinem Datenvolumen akzeptabel, später paginieren. | Offen |
| M-05 | Auth | Sentry-User wird nicht zuverlässig gesetzt/geleert. | In Root-Auth-Effekt setzen und bei Logout löschen. | Fixed |
| M-06 | Auth | Auth-Dashboard-Logs, Sentry-Events und aktuelle E-Mail-Templates wurden nicht maschinell geprüft. | Lukas prüft Supabase Dashboard und Sentry manuell. | Manuell |
| M-07 | UI | Einige Empty-/Error-States sind nur manuell geprüft, nicht automatisiert. | Smoke-/Component-Tests ergänzen. | Offen |
| M-08 | Performance | Lange Listen wurden logisch geprüft, aber noch nicht mit 100+ realen Einträgen profiliert. | TestFlight-Seed oder Profiling-Session anlegen. | Offen |

### Low
| ID | Bereich | Finding | Empfehlung | Sprint-19-Status |
|----|---------|---------|------------|------------------|
| L-01 | Onboarding | `onboarding_completed` existiert, wird im Flow aber nicht sichtbar genutzt. | Nach Launch entscheiden, ob Onboarding gebraucht wird. | Offen |
| L-02 | Tests | Rating-, Inventory-, Profile-, Account-Delete- und Export-Flows haben keine eigenen Smoke-Scripts. | Nach Launch systematisch ergänzen. | Offen |
| L-03 | App Links | Custom Scheme reicht für TestFlight, Universal Links wären später professioneller. | Nach Launch als polish aufnehmen. | Offen |

## Auth-Flow Deep Dive
- Magic Link: Der aktuelle TestFlight-Fehler entsteht, weil Supabase nach Klick auf die Mail über Safari zur App zurückkehrt und Expo Router die URL `winescanner://auth/callback` als Route sieht. Die Route existiert inzwischen, aber die Session-Verarbeitung muss zusätzlich `?code=` unterstützen, sonst bleibt der Nutzer auf dem Callback-Screen hängen oder sieht einen Routing-Fallback.
- Session Persistenz: `getSession()` und `onAuthStateChange()` sind vorhanden. Für React Native fehlt noch `processLock`, damit parallele Refresh-/Storage-Zugriffe stabiler sind.
- Profile Creation: Der DB-Trigger `handle_new_user` existiert, nutzt aber nur `full_name` oder `email`. Apple Sign-In mit versteckter E-Mail und Trigger-Ausfälle brauchen einen App-seitigen Fallback.
- Logout: `supabase.auth.signOut()` existiert, aber Query-Caches und Sentry-User werden noch nicht zentral geleert.
- Recovery: Passwort-Reset nutzt `winescanner://reset-password`. Recovery muss getrennt vom Login-Link bleiben und darf nach `setSession` nicht direkt in den App-Bereich routen.

## Performance Snapshots
- Bundle Export iOS: 2147 Module.
- Export-Größe: 6.9 MB.
- Hermes Bytecode: ca. 6.76 MB.
- Assets: ca. 488 KB.
- Liste: FlashList wird verwendet. History-/Rating-/Inventory-Items nutzen signierte Bild-URLs und `memory-disk`-Caching an den sichtbaren Bildkomponenten.

## Test-Coverage-Lücken
| Bereich | Aktuelle Abdeckung | Risiko | Empfehlung |
|---------|--------------------|--------|------------|
| Auth | Kein automatisierter End-to-End-Test | Hoch | Magic-Link, Passwort-Reset, Logout und Account-Wechsel als Smoke-Test ergänzen. |
| Rating CRUD | Kein dedizierter Test | Mittel | Bewertung erstellen, ändern, löschen, History invalidieren. |
| Inventory CRUD | Kein dedizierter Test | Mittel | Bestand hinzufügen, Quick-Action, Menge 0, Filter. |
| Profile Update | Kein dedizierter Test | Mittel | Name, Avatar Signed URL, Preferences. |
| Account Löschung | Kein dedizierter Test | Hoch | Test-Account erstellen und sauber löschen. |
| Export | Kein dedizierter Test | Niedrig | CSV/JSON-Struktur prüfen. |

## Empfehlungen für nächsten Sprint
1. Sprint 19 abschließen: Auth/Datenschutz-Fixes implementieren, Checks grün bekommen, TestFlight-Build hochladen.
2. Supabase Dashboard manuell prüfen: Redirect URLs, Magic-Link-Template, Reset-Password-Template, Auth-Logs für neue Testuser.
3. Auf echtem iPhone testen: Magic Link, neuer User, Userwechsel ohne alte Daten, Passwort-Reset, Scan-Flow.
4. Danach UX-Polish aus TestFlight-Liste fortsetzen: Storage-Orphan-Cleanup, weitere Empty/Error-States, Universal Links.

## Sprint-19 Verification
```text
$ npx tsc --noEmit
PASS

$ npx expo lint
PASS

$ npx expo-doctor
17/17 checks passed. No issues detected.

$ npm run test:storage
PASS

$ npm run test:save-scan
PASS

$ npm run test:history
PASS

$ npm run test:scan-wine
PASS

$ npm run test:extract-wine
PASS

$ npm audit
17 moderate severity vulnerabilities
No high or critical vulnerabilities.
```

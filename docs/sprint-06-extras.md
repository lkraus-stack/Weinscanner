# Sprint 06 Extras

## Was wurde implementiert
- Der Confirmation-Screen zeigt eine klare Aufforderung, wenn kein Jahrgang erkannt wurde.
- Der Nutzer kann direkt aus der Confirmation heraus einen Rückseiten-Scan starten.
- Die Kamera zeigt im Rückseiten-Modus einen passenden Hinweis für Rücketikett oder Kapsel.
- Der Jahrgang bleibt weiterhin nicht automatisch gesetzt. Die finale Pflicht-Bestätigung und Persistierung kommen in Sprint 09.

## Dateien
- `app/(app)/scan-confirm.tsx`
  - Erkennt fehlenden Jahrgang und zeigt die Karte "Jahrgang fehlt".
  - Bietet den CTA "Rücketikett scannen".
- `app/(app)/scan.tsx`
  - Liest den Route-Parameter `scanTarget=back-label`.
  - Schaltet den Kamera-Hinweis für den Rückseiten-Scan um.
- `src/components/scan/CameraOverlay.tsx`
  - Nimmt einen optionalen `hint` entgegen.

## Trigger
- Der Rückseiten-Fallback wird angezeigt, wenn `vintage_year === null`.
- Das entspricht aktuell dem praktischen Confidence-Fall `confidence.vintage_year` niedrig oder `0`, weil der Validator nicht erkannte Jahrgänge als `null` normalisiert.

## User-Flow
1. Nutzer scannt das vordere Etikett.
2. Foto wird hochgeladen und von `extract-wine` analysiert.
3. Confirmation-Screen zeigt den erkannten Wein.
4. Wenn kein Jahrgang erkannt wurde, erscheint die Karte "Jahrgang fehlt".
5. Nutzer tippt auf "Rücketikett scannen".
6. Die Kamera öffnet erneut mit dem Hinweis "Rücketikett oder Kapsel im Rahmen ausrichten".
7. Nutzer fotografiert Rücketikett oder Kapsel.
8. Der neue Scan läuft wieder durch Review, Upload und Confirmation.

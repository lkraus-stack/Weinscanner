# Sprint 05 Manuelle Tests

Diese Checkliste wird nach dem iPhone- oder Simulator-Test abgehakt.

## Kamera und Berechtigungen
- [ ] Permission-Flow mit erlaubter Kamera getestet.
- [ ] Permission-Flow mit verweigerter Kamera getestet.
- [ ] Button "Einstellungen öffnen" führt in die iOS-Einstellungen.
- [ ] Capture im Simulator erstellt ein Foto und öffnet den Review-Screen.
- [ ] Galerie-Import öffnet die Fotoauswahl und öffnet danach den Review-Screen.

## Review und Zuschnitt
- [ ] Review-Screen zeigt das aufgenommene oder importierte Foto korrekt.
- [ ] "Erneut aufnehmen" führt zurück zur Kamera.
- [ ] Crop-Option "Original" funktioniert.
- [ ] Crop-Option "4:5 zentriert" funktioniert.
- [ ] Crop-Option "Quadrat" funktioniert.

## Upload
- [ ] Erfolgreicher Upload zeigt das Loading-Overlay.
- [ ] Erfolgreicher Upload führt zurück zum Verlaufs-Tab.
- [ ] Toast "Foto hochgeladen. KI-Analyse kommt in Sprint 06." ist sichtbar.
- [ ] Datei ist im Supabase Storage Dashboard unter `wine-labels/{user_id}/{timestamp}.jpg` sichtbar.
- [ ] Upload-Fehler getestet, zum Beispiel mit Netzwerk offline.
- [ ] Fehlerfall zeigt Alert mit "Erneut versuchen" und "Abbrechen".

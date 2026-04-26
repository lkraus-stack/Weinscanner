# Sprint 16 Schritt 3, Transitions

## Ergebnis

- Verlauf, Bewertet und Bestand nutzen Reanimated `FadeIn` fuer List-Items beim ersten Daten-Render.
- Pull-to-Refresh, Filterwechsel und Scrollen loesen keine erneute Einflug-Animation aus.
- Die Detailansicht blendet das Etikettfoto mit `FadeIn.duration(400)` ein.
- Bottom-Sheets aus Schritt 2 laufen bereits ueber `@gorhom/bottom-sheet` und Reanimated.

## Modal-Audit

Diese Formular-Modals waren bereits passend konfiguriert und wurden nicht geaendert:

- `src/components/ratings/RatingModal.tsx`: `animationType="slide"`, `presentationStyle="pageSheet"`
- `src/components/inventory/AddInventoryModal.tsx`: `animationType="slide"`, `presentationStyle="pageSheet"`
- `src/components/profile/EditProfileModal.tsx`: `animationType="slide"`, `presentationStyle="pageSheet"`
- `src/components/scan/EditWineModal.tsx`: `animationType="slide"`, `presentationStyle="pageSheet"`

## Bewusst nicht umgesetzt

- Tab-Crossfade bleibt aus. React Navigation Bottom Tabs nutzt fuer Fade-Animationen intern React Native `Animated`, die Sprint-Regel verlangt aber Reanimated.
- Echte Shared-Element-Hero-Animation bleibt Backlog. Die lokale Expo-Image/Reanimated-Kette stellt keine eindeutig nutzbare `sharedTransitionTag`-API bereit, deshalb ist der robuste Foto-Fade die Sprint-16-Loesung.

## Manuelle Review

- Verlauf, Bewertet und Bestand frisch oeffnen, Items sollen gestaffelt einfaden.
- Pull-to-Refresh ausloesen, bestehende Items sollen nicht erneut einfaden.
- Detail oeffnen, das Foto soll weich erscheinen.
- Bottom-Sheets und Formular-Modals sollen weiterhin smooth von unten kommen.

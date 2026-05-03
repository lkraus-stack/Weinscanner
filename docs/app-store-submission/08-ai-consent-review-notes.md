# AI Consent Review Notes

Stand: 03. Mai 2026

## Zweck

Diese Notiz fasst die App-Review-relevanten AI-Datenfluesse zusammen. Zugangsdaten fuer Review gehoeren in App Store Connect, nicht in dieses Repository.

## Aktive Provider im aktuellen Build

- Supabase: Auth, Datenbank, Storage und Edge Functions.
- Vantero: KI-Analyse fuer Weinetiketten und Restaurant-Einschaetzungen.
- Google Places und Google Maps: Restaurant Discovery, Ortsdaten, Karte und Standortsuche.
- Sentry: Crash- und Fehlerdiagnose.
- Apple: Sign in with Apple.

Nicht aktiv im aktuellen Build:

- TripAdvisor Content API.
- Foursquare Places API.
- OpenStreetMap/Overpass.
- Perplexity, Gemini, OpenAI oder Vercel AI SDK fuer Restaurant-Chat.
- Falstaff, Gault Millau, Michelin.

## Consent-Verhalten

- Beim ersten Start einer KI-Funktion erscheint zuerst die Altersfreigabe.
- Danach erscheint eine separate KI-Freigabe.
- Ohne Zustimmung startet keine Etikett-KI und keine Restaurant-KI.
- Die Freigabe nennt Vantero sowie Google Places/Maps fuer Restaurantdaten.
- Neue KI- oder Datenprovider brauchen eine neue Gate-Version und Legal-Pruefung.

## Review-Testpfad

1. Mit Review-Account anmelden.
2. Etikett-Scan starten oder in Discover eine KI-Empfehlung oeffnen.
3. Altersfreigabe ablehnen: KI startet nicht.
4. Altersfreigabe bestaetigen, KI-Freigabe ablehnen: KI startet nicht.
5. KI-Freigabe erteilen: Die gewaehlte KI-Funktion startet.
6. Restaurant Discovery testen: Google Places/Maps sind der einzige aktive Restaurant-Provider.
7. Datenschutzseite in der App oeffnen und Providerliste gegen diese Notiz pruefen.

## Red-Team-Fragen vor Submission

- Stimmen App-Text, Datenschutz, Privacy Manifest, Review Notes und echte Netzwerkziele ueberein?
- Enthalten Mobile-Dateien direkte AI-Provider-Keys?
- Kann eine AI-Antwort Restaurants ohne echte `restaurant.id` oder `providerPlaceId` anzeigen?
- Sind TripAdvisor, Foursquare und OSM weiterhin nicht aktiv, solange Attribution, Quote und Vertrag fehlen?

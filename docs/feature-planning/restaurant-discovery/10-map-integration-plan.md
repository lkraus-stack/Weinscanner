# Restaurant-Discovery: Google Maps Integrationsplan

Stand: 2026-05-01

## Kurzfazit

Karte ist jetzt Pflicht im MVP. Wine Scanner soll Restaurants nicht nur als Liste zeigen, sondern geografisch verständlich machen. Die technische Empfehlung ist `react-native-maps` mit `PROVIDER_GOOGLE`, Google Places API für Restaurantdaten und Supabase Edge Functions für alle serverseitigen Provider-Calls.

Die Karte selbst ist nicht der eigentliche Kostentreiber. Laut offizieller Google Maps Platform Preistabelle ist `Maps SDK` aktuell `Unlimited`. Kosten entstehen vor allem durch Places, Geocoding, Photos und zu viele Re-Fetches bei Map-Bewegungen.

## 1. Zielbild MVP

Der `Entdecken` Tab besteht aus drei Kernflächen:

1. Such- und Filterleiste oben.
2. Toggle `Karte` und `Liste`.
3. Karte oder Liste als Hauptansicht.

Kartenverhalten:

- Marker für Restaurants im sichtbaren Bereich.
- Tap auf Marker zeigt Mini-Info.
- Tap auf Mini-Info öffnet Detail.
- Marker werden ab 20 sichtbaren Restaurants geclustert.
- Liste und Karte zeigen dieselbe Ergebnisbasis.

## 2. Library-Entscheidung

### Empfehlung

`react-native-maps` mit Google Maps Provider.

### Warum nicht Mapbox?

- Zusätzliche Plattform und Kostenlogik.
- Mehr Styling-Möglichkeiten, aber für MVP zu viel Komplexität.
- Restaurantdaten kommen ohnehin aus Google Places.

### Warum nicht native iOS Maps?

- Apple Maps wäre auf iOS einfach, aber Restaurantdaten kommen aus Google Places.
- Google Place IDs, Google Maps Links und Google Kartenansicht sind konsistenter.
- Wenn Nutzer später zu Google Maps navigieren, ist die mentale Verbindung klarer.

### Warum nicht `expo-maps`?

- Interessant, aber für dieses Projekt ist `react-native-maps` aktuell etablierter.
- Mehr Beispiele, mehr Community, bekannteres Verhalten in React Native Apps.

## 3. Expo SDK 54 Setup

Geplante Installation in Sprint 22:

```bash
npx expo install react-native-maps
```

Konfiguration in `app.config.ts`:

```ts
ios: {
  config: {
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY ?? '',
  },
}
```

Map-Komponente:

```tsx
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

<MapView provider={PROVIDER_GOOGLE} />;
```

Wichtig:

- `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` ist im Bundle sichtbar. Das ist bei Mobile Maps SDK Keys normal.
- Schutz entsteht durch iOS Bundle-ID Restriction in Google Cloud, nicht durch Geheimhaltung im Bundle.
- Server-Keys für Places, Geocoding und Photos gehören nicht in die App. Sie bleiben in Supabase Secrets.

## 4. Google Cloud Setup für Lukas

Schritte:

1. Google Cloud Console öffnen.
2. Projekt anlegen oder vorhandenes Projekt nutzen.
3. Billing aktivieren.
4. APIs aktivieren:
   - Maps SDK for iOS.
   - Places API (New).
   - Geocoding API.
5. API-Key für iOS Maps SDK erstellen.
6. Key einschränken:
   - Application restriction: iOS apps.
   - Bundle ID: `com.francoconsulting.winescanner`.
   - API restrictions: Maps SDK for iOS.
7. Separaten Server-Key für Supabase Edge Functions erstellen.
8. Server-Key einschränken:
   - API restrictions: Places API (New), Geocoding API.
   - Wenn möglich IP/Server-Einschränkung prüfen. Bei Supabase Edge Functions kann IP-Restriktion schwierig sein, deshalb Quotas streng setzen.
9. Quota-Warnungen setzen:
   - 50 Prozent.
   - 80 Prozent.
   - 100 Prozent.
10. Tägliche und monatliche Budget-Alerts aktivieren.

## 5. EAS und Secrets

Für iOS Maps SDK:

```bash
npx eas-cli env:create --environment production --name EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY --value "..."
```

Hinweis:

- Auch wenn EAS den Wert verwaltet, ist ein `EXPO_PUBLIC_` Wert später in der App sichtbar.
- Deshalb ist die Bundle-ID Restriction Pflicht.

Für Supabase Edge Functions:

```bash
npx supabase secrets set GOOGLE_PLACES_API_KEY="..."
```

Optional getrennt:

```bash
npx supabase secrets set GOOGLE_GEOCODING_API_KEY="..."
```

## 6. Privacy Manifest und Permission

### iOS Permission

Neue `infoPlist` Permission:

```ts
NSLocationWhenInUseUsageDescription:
  'Wir nutzen deinen Standort, um Restaurants in deiner Nähe zu finden.',
```

Empfohlener längerer App-Kontext vor dem Systemdialog:

"Mit deinem Standort zeigen wir dir Restaurants in deiner Nähe. Du kannst auch eine Stadt manuell eingeben."

### Privacy Manifest

Vor Release prüfen:

- Location als collected data in App Store Connect.
- Zweck: App Functionality.
- Kein Tracking.
- Keine dauerhafte Hintergrundposition.
- Keine präzise Standorthistorie ohne expliziten Nutzen.

### Datenschutzseite

Datenschutzseite erweitern um:

- Standortnutzung.
- Google Maps Platform als externer Anbieter.
- Google Places API.
- Zweck: Restaurant-Suche und Navigation.
- Speicherdauer: möglichst nur Restaurant-IDs und gerundete Suchbereiche, keine Bewegungsprofile.

## 7. Geo-Permission-Flow

### App-Start ohne Permission

Der `Entdecken` Tab startet ohne Systemdialog. Stattdessen:

- Suchfeld "Stadt oder Adresse suchen".
- Button "Standort verwenden".
- Karte zeigt Default-Location, wenn keine Stadt gewählt ist.

Default:

- München-Stadtmitte.
- Zoom-Level 12.
- Radius ca. 5 km.

### User tippt "Standort verwenden"

Flow:

1. Eigener Erklärscreen oder Inline-Panel.
2. iOS Permission-Dialog.
3. Bei Erfolg: Karte zentriert auf User-Location.
4. Bei Ablehnung: Stadt-Suche bleibt aktiv.

### Persistenz

In `profiles.preferences` speichern:

```json
{
  "restaurantDiscovery": {
    "lastCity": "München",
    "lastMapCenter": {
      "lat": 48.137154,
      "lng": 11.576124
    },
    "preferredView": "map"
  }
}
```

Nicht speichern:

- Fortlaufende Standorthistorie.
- Bewegungsdaten.
- Jede Map-Bewegung.

## 8. Karten-Initial-Center

Priorität:

1. User-Location, wenn Permission erlaubt.
2. Letzte gewählte Stadt aus Preferences.
3. Letztes manuelles Map-Center aus Preferences.
4. Default München-Stadtmitte.

Initial:

```ts
{
  latitude: 48.137154,
  longitude: 11.576124,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
}
```

## 9. Marker-Daten-Fetch

### Strategie

Bounding-Box-basierte Restaurant-Abfrage.

Input an Edge Function:

```ts
type RestaurantMapSearchInput = {
  bounds: {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  };
  center: { lat: number; lng: number };
  zoom: number;
  filters: {
    openNow?: boolean;
    minRating?: number;
    cuisine?: string;
    priceLevels?: string[];
  };
};
```

### Debounce

- 500 ms nach letzter Map-Bewegung.
- Kein Fetch, wenn sich Bounds nur minimal geändert haben.
- Kein Fetch während User aktiv pincht oder pannt.

### Cache

- Bounding-Box auf Raster runden.
- Cache-Key aus Provider, Bounds-Bucket, Zoom, Filtern.
- Cache-Dauer im MVP: 5 Minuten für Viewport-Suchen.
- Restaurant-Stammdaten: 30 Tage.
- Bewertungen/Öffnungszeiten: 7 Tage.

## 10. Marker-Design

Offene Designentscheidung für Lukas:

| Variante | Vorteil | Nachteil |
| --- | --- | --- |
| Standard Google Pins | Schnell, vertraut | Wenig Wine-Scanner-Brand |
| Wein-Glas-Icon | Eigenständig | Kann auf Karte verspielt wirken |
| Farbcodiert nach Bewertung | Schnell erfassbar | Bewertung wird sehr dominant |
| Offen/Geschlossen Farbe | Praktisch | Kann mit Bewertung kollidieren |

Empfehlung für MVP:

- Standard Google Pin oder dezenter Wine-Scanner-Pin.
- Kleine Farbcodierung nur für "offen" und "geschlossen".
- Bewertung in Mini-Info zeigen, nicht direkt als aggressive Markerfarbe.

## 11. Karten-Style

Optionen:

| Style | Aufwand | Empfehlung |
| --- | ---: | --- |
| Standard Google Maps | 0 Tage | MVP-Start |
| Custom Wine-Scanner Style | ca. 1 Tag | Nach erstem Test |

Empfehlung:

- MVP mit Standard Google Maps starten.
- Wenn es zu generisch wirkt, Warm-Neutral Style später ergänzen.
- Custom Style muss in Light und Dark Mode getestet werden.

## 12. "Aktuell offen" auf Karte

Optionen:

1. Marker grün, wenn offen, grau, wenn geschlossen.
2. Nur Filter "Jetzt offen".
3. Mini-Info zeigt Öffnungsstatus.

Empfehlung:

- Filter "Jetzt offen" prominent.
- Mini-Info zeigt Öffnungsstatus.
- Marker nicht zu stark färben, sonst wirkt die Karte schnell unruhig.

## 13. Performance-Regeln

Pflicht:

- Maximal 50 Marker im sichtbaren Bereich.
- Clustering ab 20 sichtbaren Markern.
- Keine Bilder in Markern.
- Mini-Info nur für aktiven Marker.
- `React.memo` für Marker-Komponenten.
- Debounce 500 ms.
- Cache-Hit vor Provider-Call.
- iPhone 12 und kleineres iPhone im TestFlight testen.

## 14. Testplan

Automatisch:

- Cache-Key für Bounds.
- Debounce-Logik.
- Provider-Mapping für Marker.
- Stadt-Suche über Geocoding.
- RLS für gespeicherte Restaurants.

Manuell:

- App ohne Location Permission öffnen.
- Stadt "München" suchen.
- Karte pan/zoom.
- Marker antippen.
- Mini-Info öffnet Detail.
- Toggle Liste/Karte.
- Filter "Jetzt offen".
- Standort erlauben.
- Standort verweigern.
- Dark Mode.
- Schlechte Verbindung.

## 15. Offene Fragen

1. Default-View: Karte zuerst, Liste zuerst oder Toggle gleich prominent?
2. Tab-Name: `Entdecken`, `Erleben` oder anderer Name?
3. Karten-Style: Standard Google Maps oder Wine-Scanner Custom Style?
4. Marker-Design: Standard-Pin, Wein-Icon oder Bewertungsfarbe?
5. "Aktuell offen": Markerfarbe oder nur Filter/Mini-Info?
6. Default-Stadt: München oder Standort von Lukas/Franco Consulting?
7. Budgetlimit: 200 bis 400 EUR für den ersten Map-MVP akzeptiert?

## Quellen

- [Google Maps Platform Pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Maps SDK for iOS Usage and Billing](https://developers.google.com/maps/documentation/ios-sdk/usage-and-billing)
- [react-native-maps Expo Docs](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [Expo Location](https://docs.expo.dev/versions/v54.0.0/sdk/location/)
- [Google Places API Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields)

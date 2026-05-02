export type LegalDocumentType = 'privacy' | 'imprint';

export type LegalLink = {
  label: string;
  url: string;
};

export type LegalSection = {
  title: string;
  body?: readonly string[];
  items?: readonly string[];
  links?: readonly LegalLink[];
};

export type LegalDocument = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: readonly LegalSection[];
};

export const legalDocuments = {
  privacy: {
    title: 'Datenschutzerklärung',
    updatedAt: '02. Mai 2026',
    intro:
      'Diese Datenschutzhinweise gelten für die mobile App Wine Scanner. Sie erklären, welche Daten wir verarbeiten, wenn du Weine scannst, bewertest, verwaltest, Restaurants entdeckst oder dein Konto nutzt.',
    sections: [
      {
        title: 'Verantwortlicher',
        body: [
          'Franco Consulting GmbH, Maria-Theresia-Strasse 17, 89331 Burgau, Deutschland.',
          'Vertreten durch die Geschäftsführer Kilian Franco und Lukas Kraus. Datenschutzanfragen kannst du an kontakt@franco-consulting.com senden.',
        ],
      },
      {
        title: 'Welche Daten die App verarbeitet',
        items: [
          'Accountdaten wie E-Mail-Adresse, Nutzer-ID und Login-Informationen, auch bei Sign in with Apple.',
          'Profildaten wie Display-Name, Avatarbild und App-Einstellungen, soweit du sie freiwillig hinterlegst.',
          'Wein-Scans wie Etikettfotos, optionale Rückseitenbilder und KI-extrahierte Weindaten, zum Beispiel Weingut, Weinname, Jahrgang, Region, Rebsorte, Farbe, Trinkfenster, Aromen und Beschreibung.',
          'Bewertungen, Notizen, Anlässe, Bestandsdaten, Mengen, Lagerorte und Kaufpreise.',
          'Restaurantdaten, wenn du Restaurants suchst, merkst, bewertest oder Besuche dokumentierst.',
          'Technische Fehler- und Crashdaten, die uns helfen, die App stabil und sicher zu betreiben.',
        ],
      },
      {
        title: 'Zwecke und Rechtsgrundlagen',
        body: [
          'Wir verarbeiten deine Daten, um die App-Funktionen bereitzustellen: Login, Profil, Scan-Analyse, Verlauf, Bewertungen, Bestand, Datenexport, Account-Löschung und Restaurant Discovery.',
          'Account-, Profil-, Scan-, Bewertungs-, Bestands- und Restaurantdaten verarbeiten wir auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, soweit dies für die Nutzung der App erforderlich ist.',
          'Technische Fehlerdaten und Sicherheitsereignisse verarbeiten wir auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist ein stabiler, sicherer und fehlerarmer App-Betrieb.',
          'Standortdaten werden nur verarbeitet, wenn du der App die Standortfreigabe erteilst. Du kannst die Erlaubnis jederzeit in den iOS-Einstellungen widerrufen.',
        ],
      },
      {
        title: 'KI-Analyse von Weinetiketten',
        body: [
          'Wenn du ein Etikett scannst, werden das Foto oder temporäre Bild-URLs an unseren KI-Dienst übermittelt, damit Weininformationen erkannt und strukturiert zurückgegeben werden können.',
          'Die KI wird für die automatische Extraktion und Plausibilisierung von Weindaten eingesetzt. Deine gespeicherten App-Daten bleiben in deinem Nutzerkonto und werden nicht für Werbeprofile oder Cross-App-Tracking verwendet.',
        ],
      },
      {
        title: 'Restaurant Discovery und Standort',
        body: [
          'Wenn du Restaurant Discovery nutzt und den Standort freigibst, werden GPS-Koordinaten an Google Places übermittelt, um Restaurants in deiner Umgebung zu finden. Standortdaten werden von uns nicht persistent als Standortverlauf gespeichert.',
          'Google Places liefert Restaurantnamen, Adressen, Bewertungen, Fotos, Öffnungszeiten und weitere Ortsdaten. Die Kartenanzeige lädt Karten- und Ortsdaten über das Google Maps SDK.',
          'Beim Laden von Google Places und Google Maps können technische Daten wie IP-Adresse, Geräteinformationen, App-Informationen und Standortinformationen durch Google verarbeitet werden.',
          'Wenn du ein Restaurant merkst, bewertest oder einen Besuch speicherst, werden diese nutzergenerierten Daten in unserer Supabase-Datenbank gespeichert und bei Account-Löschung entfernt, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.',
        ],
        links: [
          {
            label: 'Google Datenschutzerklärung',
            url: 'https://policies.google.com/privacy',
          },
          {
            label: 'Google Maps Platform Terms',
            url: 'https://cloud.google.com/maps-platform/terms',
          },
        ],
      },
      {
        title: 'Drittanbieter',
        items: [
          'Supabase: Authentifizierung, Datenbank und Speicherung von App-Daten. Die produktive Datenbank wird in der EU-Region Frankfurt betrieben.',
          'Vantero: KI-Analyse von Weinetiketten. Übermittelt werden die für die Analyse erforderlichen Etikettbilder oder temporären Bild-URLs.',
          'Sentry: Fehler- und Crash-Monitoring zur Stabilisierung der App.',
          'Apple: Sign in with Apple, sofern du diese Login-Methode nutzt. Apple verarbeitet Anmeldedaten in eigener Verantwortung.',
          'Google LLC, USA: Google Places API und Google Maps SDK für Restaurant Discovery und Kartenanzeige. Google verarbeitet diese Daten als eigener Verantwortlicher bzw. Controller im Rahmen der Google Maps Platform Bedingungen.',
        ],
        links: [
          {
            label: 'Google Controller-Controller Data Protection Terms',
            url: 'https://business.safety.google/controllerterms/',
          },
        ],
      },
      {
        title: 'Internationale Datenübermittlung',
        body: [
          'Die Hauptdatenverarbeitung für Authentifizierung, Datenbank, Storage und App-Daten erfolgt nach aktuellem Setup in der Europäischen Union.',
          'Bei Sign in with Apple, Google Places, Google Maps und einzelnen technischen Diensten kann eine Verarbeitung in den USA stattfinden. Soweit erforderlich, stützen die Anbieter solche Übermittlungen auf geeignete Garantien, insbesondere Standardvertragsklauseln nach Art. 46 DSGVO oder andere anwendbare Übermittlungsmechanismen.',
        ],
      },
      {
        title: 'Speicherdauer und Löschung',
        body: [
          'Deine App-Daten werden gespeichert, solange dein Nutzerkonto besteht. Du kannst dein Konto in der App löschen. Dabei werden personenbezogene User-Daten wie Profil, Scans, Bewertungen, Bestände, gespeicherte Restaurants, Restaurantbewertungen, Restaurantbesuche und gespeicherte Etikettfotos entfernt.',
          'Globale, nicht personenbezogene Wein-Stammdaten können weiter gespeichert bleiben, sofern sie keinen Personenbezug zu deinem Account enthalten.',
        ],
      },
      {
        title: 'Datenexport und deine Rechte',
        body: [
          'Du kannst deine Daten in der App als CSV oder JSON exportieren. Außerdem hast du im Rahmen der gesetzlichen Voraussetzungen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Datenschutzaufsichtsbehörde.',
          'Zur Ausübung deiner Rechte kannst du dich jederzeit an kontakt@franco-consulting.com wenden.',
        ],
      },
      {
        title: 'Keine Werbung und kein Datenverkauf',
        body: [
          'Wir verkaufen keine personenbezogenen App-Daten an Datenbroker. Eine Nutzung deiner App-Daten für Cross-App-Tracking oder personalisierte Werbung findet nicht statt.',
        ],
      },
      {
        title: 'Hinweis',
        body: [
          'Dieser Text ist ein praxisnaher technischer Entwurf für die App und sollte vor Veröffentlichung juristisch geprüft werden.',
        ],
      },
    ],
  },
  imprint: {
    title: 'Impressum',
    updatedAt: '02. Mai 2026',
    intro:
      'Angaben gemäß § 5 DDG und § 18 Abs. 2 MStV für die mobile App Wine Scanner.',
    sections: [
      {
        title: 'Anbieter',
        body: [
          'Franco Consulting GmbH',
          'Maria-Theresia-Strasse 17',
          '89331 Burgau',
          'Deutschland',
        ],
      },
      {
        title: 'Vertretungsberechtigte Geschäftsführer',
        body: ['Kilian Franco und Lukas Kraus.'],
      },
      {
        title: 'Kontakt',
        body: ['E-Mail: kontakt@franco-consulting.com', 'Telefon: 08222 4183998'],
      },
      {
        title: 'Registereintrag',
        body: ['Registergericht: Amtsgericht Memmingen', 'Registernummer: HRB 20230'],
      },
      {
        title: 'Umsatzsteuer-ID',
        body: ['Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE358098950'],
      },
      {
        title: 'Geltungsbereich',
        body: ['Dieses Impressum gilt für die mobile App Wine Scanner.'],
      },
      {
        title: 'Verbraucherstreitbeilegung',
        body: [
          'Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
        ],
      },
    ],
  },
} as const satisfies Record<LegalDocumentType, LegalDocument>;

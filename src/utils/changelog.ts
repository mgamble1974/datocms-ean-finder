export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.4.1',
    date: '2026-04-20T00:00:00Z',
    changes: [
      'CORS-fout opgelost: Icecat wordt nu via een Vercel proxy-functie aangeroepen in plaats van rechtstreeks vanuit de browser',
      'Debug-log toont nu zowel de Icecat URL (server-side) als de proxy-route',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-04-20T00:00:00Z',
    changes: [
      'Debug-log toegevoegd in de zijbalk: stap-voor-stap overzicht van elke zoekopdracht',
      'Log toont: EAN-validatie, gebruikersnaam, authenticatiemethode, request URL, HTTP-status, responstijd, Icecat-melding, productdetails en afbeeldingsbeschikbaarheid',
      'Bij fouten klapt de debug-log automatisch uit zodat de oorzaak direct zichtbaar is',
      'Bij succes blijft de log ingeklapt maar is hij altijd beschikbaar',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-04-17T00:00:00Z',
    changes: [
      'EAN-zoekopdracht start nu direct na het indrukken van Enter in het invoerveld',
      'Exact tijdstip (inclusief milliseconden) in het activiteitenlog weergegeven',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-04-17T00:00:00Z',
    changes: [
      'Opslaan-knop in instellingenscherm alleen actief bij wijzigingen (isDirty)',
      'Uitgebreide logging met uitklapbare details per log-entry',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-04-17T00:00:00Z',
    changes: [
      'Activiteitenlog toegevoegd: alle EAN-zoekopdrachten worden bijgehouden met tijdstempel, EAN-code, HTTP-status en responstijd',
      'Plugin in-/uitschakelaar toegevoegd in de instellingen',
      'Veld voor Icecat API-sleutel toegevoegd (voor authenticatie via Basic Auth)',
      'Changelog toegevoegd in de instellingen',
      'Tabbladen in instellingenscherm voor overzicht',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-04-17T00:00:00Z',
    changes: [
      'Initiële release',
      'EAN-code opzoeken via Icecat live API',
      'Sidebar-widget in elk DatoCMS-record',
      'Productnaam, merk en afbeelding automatisch invullen in gekoppelde velden',
      'Technische specificaties exporteren als JSON naar een gekoppeld veld',
      'Specificaties per groep uitklappen in de zijbalk',
    ],
  },
];

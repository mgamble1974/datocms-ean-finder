export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
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

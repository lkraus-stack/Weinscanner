import Ionicons from '@expo/vector-icons/Ionicons';

export type AromaVisual = {
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type AromaRule = AromaVisual & {
  terms: string[];
};

const AROMA_RULES: AromaRule[] = [
  {
    category: 'Frucht',
    icon: 'nutrition-outline',
    terms: [
      'ananas',
      'apfel',
      'aprikose',
      'birne',
      'brombeere',
      'cassis',
      'frucht',
      'himbeere',
      'kirsche',
      'mango',
      'pfirsich',
      'pflaume',
      'tropisch',
    ],
  },
  {
    category: 'Zitrus',
    icon: 'sunny-outline',
    terms: ['grapefruit', 'limette', 'orange', 'zitrone', 'zitrus'],
  },
  {
    category: 'Blüte',
    icon: 'flower-outline',
    terms: ['blume', 'blute', 'bluete', 'floral', 'rose', 'veilchen'],
  },
  {
    category: 'Holz',
    icon: 'leaf-outline',
    terms: ['barrique', 'eiche', 'eichenholz', 'holz', 'toast', 'zeder'],
  },
  {
    category: 'Nuss',
    icon: 'ellipse-outline',
    terms: ['haselnuss', 'mandel', 'nuss', 'nuesse', 'nusse', 'walnuss'],
  },
  {
    category: 'Creme',
    icon: 'water-outline',
    terms: ['butter', 'creme', 'cremig', 'hefe', 'joghurt', 'milch'],
  },
  {
    category: 'Wuerze',
    icon: 'flame-outline',
    terms: ['gewuerz', 'gewurz', 'nelke', 'pfeffer', 'tabak', 'wuerze', 'wurze', 'zimt'],
  },
  {
    category: 'Suess',
    icon: 'cafe-outline',
    terms: ['honig', 'karamell', 'schokolade', 'suss', 'toffee', 'vanille'],
  },
  {
    category: 'Mineral',
    icon: 'earth-outline',
    terms: ['kreide', 'mineral', 'salz', 'schiefer', 'stein'],
  },
  {
    category: 'Kraeuter',
    icon: 'leaf-outline',
    terms: ['gras', 'kraeuter', 'krauter', 'minze', 'salbei', 'thymian'],
  },
];

const EXACT_AROMA_ICONS: Record<string, string> = {
  ananas: '🍍',
  apfel: '🍏',
  aprikose: '🍑',
  birne: '🍐',
  brombeere: '🫐',
  cassis: '🫐',
  grapefruit: '🍊',
  himbeere: '🍓',
  honig: '🍯',
  karamell: '🍯',
  kirsche: '🍒',
  mango: '🥭',
  nuss: '🌰',
  pfirsich: '🍑',
  schokolade: '🍫',
  vanille: '🌼',
  zitrone: '🍋',
  zitrus: '🍋',
};

function normalizeAroma(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

export function getAromaVisual(aroma: string): AromaVisual {
  const normalizedAroma = normalizeAroma(aroma);
  const match = AROMA_RULES.find((rule) =>
    rule.terms.some((term) => normalizedAroma.includes(term))
  );

  return match
    ? { category: match.category, icon: match.icon }
    : { category: 'Aroma', icon: 'sparkles-outline' };
}

export function getAromaIcon(aroma: string): string {
  const normalizedAroma = normalizeAroma(aroma);
  const exactIcon = EXACT_AROMA_ICONS[normalizedAroma];

  if (exactIcon) {
    return exactIcon;
  }

  const visual = getAromaVisual(aroma);

  switch (visual.category) {
    case 'Blüte':
      return '🌸';
    case 'Creme':
      return '🧈';
    case 'Frucht':
      return '🍏';
    case 'Holz':
      return '🪵';
    case 'Mineral':
      return '🪨';
    case 'Nuss':
      return '🌰';
    case 'Suess':
      return '🍯';
    case 'Wuerze':
      return '🍂';
    case 'Zitrus':
      return '🍋';
    default:
      return '✨';
  }
}

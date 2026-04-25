export const AROMA_ICONS: Record<string, string> = {
  Ananas: '🍍',
  Apfel: '🍏',
  Aprikose: '🍑',
  Birne: '🍐',
  Brombeere: '🫐',
  Cassis: '🫐',
  Eiche: '🪵',
  'Florale Noten': '🌸',
  Grapefruit: '🍊',
  Himbeere: '🍓',
  Honig: '🍯',
  Kirsche: '🍒',
  Leder: '🧳',
  Mango: '🥭',
  Mineralien: '🪨',
  Nuss: '🌰',
  Passionsfrucht: '🍈',
  Pfirsich: '🍑',
  Schokolade: '🍫',
  Schwarzkirsche: '🍒',
  Tabak: '🍂',
  Vanille: '🌼',
  Zeder: '🪵',
  Zitrone: '🍋',
  Zitruszeste: '🍋',
};

const NORMALIZED_AROMA_ICONS = Object.entries(AROMA_ICONS).reduce<
  Record<string, string>
>((map, [aroma, icon]) => {
  map[aroma.trim().toLocaleLowerCase('de-DE')] = icon;

  return map;
}, {});

export function getAromaIcon(aroma: string): string {
  return NORMALIZED_AROMA_ICONS[aroma.trim().toLocaleLowerCase('de-DE')] ?? '🍷';
}

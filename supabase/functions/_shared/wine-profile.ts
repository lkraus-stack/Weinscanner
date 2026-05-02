export type WineProfileBadge =
  | 'Sommelier'
  | 'Vinothek'
  | 'Weinbar'
  | 'Weinkarte';

export type WineProfile = {
  badges: WineProfileBadge[];
  hasSommelier: boolean;
  hasWineCard: boolean;
  isFullWineProfile: boolean;
  isWineBar: boolean;
  wineMentions: number;
  wineScore: 0 | 1 | 2 | 3;
};

type WineProfileInput = {
  cuisine?: string | null;
  name: string;
  reviewTexts?: string[];
  servesWine?: boolean | null;
  types?: string[] | null;
};

const LATENT_WINE_TYPES = new Set([
  'french_restaurant',
  'italian_restaurant',
  'mediterranean_restaurant',
]);

function normalize(value: string) {
  return value.toLocaleLowerCase('de-DE');
}

function includesKeyword(texts: string[], keyword: string) {
  const normalizedKeyword = normalize(keyword);

  return texts.some((text) => normalize(text).includes(normalizedKeyword));
}

function countKeyword(texts: string[], keyword: string) {
  const normalizedKeyword = normalize(keyword);

  return texts.reduce((count, text) => {
    const normalizedText = normalize(text);
    let nextIndex = 0;
    let matches = 0;

    while (nextIndex < normalizedText.length) {
      const matchIndex = normalizedText.indexOf(
        normalizedKeyword,
        nextIndex
      );

      if (matchIndex === -1) {
        break;
      }

      matches += 1;
      nextIndex = matchIndex + normalizedKeyword.length;
    }

    return count + matches;
  }, 0);
}

function uniqueBadges(badges: WineProfileBadge[]) {
  return Array.from(new Set(badges));
}

function getWineScore({
  hasSommelier,
  hasWineCard,
  isFullWineProfile,
  wineMentions,
}: {
  hasSommelier: boolean;
  hasWineCard: boolean;
  isFullWineProfile: boolean;
  wineMentions: number;
}): 0 | 1 | 2 | 3 {
  if (
    isFullWineProfile ||
    wineMentions >= 6 ||
    (hasSommelier && hasWineCard)
  ) {
    return 3;
  }

  if (
    wineMentions >= 3 ||
    (hasWineCard && (hasSommelier || wineMentions > 0))
  ) {
    return 2;
  }

  if (wineMentions >= 1 || hasSommelier) {
    return 1;
  }

  return 0;
}

export function getRestaurantWineProfile({
  cuisine,
  name,
  reviewTexts = [],
  servesWine,
  types = [],
}: WineProfileInput): WineProfile | null {
  const normalizedTypes = types ?? [];
  const contextTexts = [
    name,
    cuisine,
    ...normalizedTypes,
  ].filter((value): value is string => typeof value === 'string');
  const hasSommelier = includesKeyword(reviewTexts, 'Sommelier');
  const hasWineCard =
    includesKeyword(reviewTexts, 'Weinkarte') ||
    includesKeyword(reviewTexts, 'Weinauswahl');
  const hasVinothek = includesKeyword([name], 'Vinothek');
  const hasWineBarName =
    includesKeyword([name], 'Weinbar') ||
    includesKeyword([name], 'Wine Bar');
  const hasWineBarType = normalizedTypes.includes('wine_bar');
  const hasWineBarCuisine = cuisine
    ? includesKeyword([cuisine], 'Weinbar')
    : false;
  const isWineBar =
    hasVinothek || hasWineBarName || hasWineBarType || hasWineBarCuisine;
  const latentWinePoint = normalizedTypes.some((type) =>
    LATENT_WINE_TYPES.has(type)
  )
    ? 1
    : 0;
  const servesWinePoint = servesWine === true ? 1 : 0;
  const wineMentions =
    countKeyword([...reviewTexts, ...contextTexts], 'Wein') +
    latentWinePoint +
    servesWinePoint;
  const isFullWineProfile = isWineBar;
  const wineScore = getWineScore({
    hasSommelier,
    hasWineCard,
    isFullWineProfile,
    wineMentions,
  });
  const badges = uniqueBadges([
    hasSommelier ? 'Sommelier' : null,
    hasWineCard ? 'Weinkarte' : null,
    hasVinothek ? 'Vinothek' : null,
    hasWineBarName || hasWineBarType || hasWineBarCuisine
      ? 'Weinbar'
      : null,
  ].filter((badge): badge is WineProfileBadge => Boolean(badge)));

  if (wineScore === 0 && badges.length === 0) {
    return null;
  }

  return {
    badges,
    hasSommelier,
    hasWineCard,
    isFullWineProfile,
    isWineBar,
    wineMentions,
    wineScore,
  };
}

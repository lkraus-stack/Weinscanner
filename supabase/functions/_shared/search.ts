type SearchWineOptions = {
  grapeVariety?: string | null;
  producer: string;
  vintageYear?: number | null;
  wineName: string;
};

const MIN_PRODUCER_SIMILARITY = 0.55;
const MIN_WINE_NAME_SIMILARITY = 0.72;
const MIN_COMBINED_SIMILARITY = 0.78;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSet(value: string | null | undefined) {
  if (!value) {
    return new Set<string>();
  }

  return new Set(
    normalizeSearchText(value)
      .split(' ')
      .filter((token) => token.length > 3)
  );
}

function hasGrapeConflict(
  queryGrapeVariety: string | null | undefined,
  candidateGrapeVariety: string | null | undefined
) {
  const queryTokens = tokenSet(queryGrapeVariety);
  const candidateTokens = tokenSet(candidateGrapeVariety);

  if (queryTokens.size === 0 || candidateTokens.size === 0) {
    return false;
  }

  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      return false;
    }
  }

  return true;
}

function isAcceptableCacheMatch(match: Record<string, unknown>) {
  const producerSimilarity = numberOrNull(match.producer_similarity) ?? 0;
  const wineNameSimilarity = numberOrNull(match.wine_name_similarity) ?? 0;
  const combinedSimilarity = numberOrNull(match.similarity) ?? 0;

  return (
    producerSimilarity >= MIN_PRODUCER_SIMILARITY &&
    wineNameSimilarity >= MIN_WINE_NAME_SIMILARITY &&
    combinedSimilarity >= MIN_COMBINED_SIMILARITY
  );
}

export async function searchWineInDb(
  supabase: {
    from: (table: string) => unknown;
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
      data: unknown;
      error: Error | null;
    }>;
  },
  { grapeVariety, producer, vintageYear, wineName }: SearchWineOptions
) {
  const { data: matches, error: rpcError } = await supabase.rpc(
    'search_wines',
    {
      query_grape_variety: grapeVariety ?? null,
      query_producer: producer,
      query_wine_name: wineName,
      similarity_threshold: 0.35,
    }
  );

  if (rpcError) {
    throw rpcError;
  }

  const acceptableMatches = Array.isArray(matches)
    ? matches.filter((match) => {
        if (!isRecord(match)) {
          return false;
        }

        return isAcceptableCacheMatch(match);
      })
    : [];

  if (acceptableMatches.length === 0) {
    return { found: false as const };
  }

  let bestMatch: Record<string, unknown> | null = null;
  let wine: unknown = null;
  let rejectedMatch: { reason: string; wine: unknown } | null = null;

  for (const match of acceptableMatches) {
    if (!isRecord(match) || typeof match.id !== 'string') {
      continue;
    }

    const wineQuery = (
      supabase.from('wines') as {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            single: () => Promise<{ data: unknown; error: Error | null }>;
          };
        };
      }
    )
      .select('*')
      .eq('id', match.id);
    const { data, error: wineError } = await wineQuery.single();

    if (wineError) {
      throw wineError;
    }

    if (
      isRecord(data) &&
      hasGrapeConflict(grapeVariety, stringOrNull(data.grape_variety))
    ) {
      rejectedMatch = {
        reason: 'grape_variety_conflict',
        wine: data,
      };
      continue;
    }

    bestMatch = match;
    wine = data;
    break;
  }

  const bestMatchId =
    bestMatch && isRecord(bestMatch) ? stringOrNull(bestMatch.id) : null;

  if (!bestMatchId || !isRecord(wine)) {
    return {
      found: false as const,
      ...(rejectedMatch ? { rejectedMatch } : {}),
    };
  }

  const acceptedMatch = bestMatch as Record<string, unknown>;
  const vintagesQuery = (
    supabase.from('vintages') as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          order: (
            column: string,
            options: { ascending: boolean }
          ) => Promise<{ data: unknown; error: Error | null }>;
        };
      };
    }
  )
    .select('*')
    .eq('wine_id', bestMatchId);
  const { data: vintages, error: vintagesError } = await vintagesQuery.order(
    'vintage_year',
    { ascending: false }
  );

  if (vintagesError) {
    throw vintagesError;
  }

  const vintageList = Array.isArray(vintages) ? vintages : [];
  const matchedVintage =
    typeof vintageYear === 'number'
      ? vintageList.find((vintage) => {
          if (!isRecord(vintage)) {
            return false;
          }

          return Number(vintage.vintage_year) === vintageYear;
        }) ?? null
      : null;

  return {
    found: true as const,
    matchedVintage,
    producerSimilarity: numberOrNull(acceptedMatch.producer_similarity) ?? 0,
    similarity: numberOrNull(acceptedMatch.similarity) ?? 0,
    vintages: vintageList,
    wine,
    wineNameSimilarity: numberOrNull(acceptedMatch.wine_name_similarity) ?? 0,
  };
}

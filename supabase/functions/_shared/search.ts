type SearchWineOptions = {
  producer: string;
  vintageYear?: number | null;
  wineName: string;
};

const CACHE_HIT_THRESHOLD = 0.7;

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

export async function searchWineInDb(
  supabase: {
    from: (table: string) => unknown;
    rpc: (name: string, args: Record<string, unknown>) => Promise<{
      data: unknown;
      error: Error | null;
    }>;
  },
  { producer, vintageYear, wineName }: SearchWineOptions
) {
  const { data: matches, error: rpcError } = await supabase.rpc(
    'search_wines',
    {
      query_producer: producer,
      query_wine_name: wineName,
      similarity_threshold: 0.4,
    }
  );

  if (rpcError) {
    throw rpcError;
  }

  const bestMatch = Array.isArray(matches)
    ? matches.find((match) => {
        if (!isRecord(match)) {
          return false;
        }

        const similarity = numberOrNull(match.similarity);

        return similarity !== null && similarity > CACHE_HIT_THRESHOLD;
      })
    : null;

  if (!isRecord(bestMatch) || typeof bestMatch.id !== 'string') {
    return { found: false as const };
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
    .eq('id', bestMatch.id);
  const { data: wine, error: wineError } = await wineQuery.single();

  if (wineError) {
    throw wineError;
  }

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
    .eq('wine_id', bestMatch.id);
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
    similarity: numberOrNull(bestMatch.similarity) ?? 0,
    vintages: vintageList,
    wine,
  };
}

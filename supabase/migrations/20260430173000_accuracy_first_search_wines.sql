SET search_path = public, extensions;

DROP FUNCTION IF EXISTS public.search_wines(text, text, float);

CREATE INDEX IF NOT EXISTS idx_wines_producer_trgm
  ON public.wines
  USING gin (producer gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_wines_grape_variety_trgm
  ON public.wines
  USING gin (grape_variety gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_wines(
  query_producer text,
  query_wine_name text,
  similarity_threshold float DEFAULT 0.35,
  query_grape_variety text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  producer text,
  wine_name text,
  grape_variety text,
  region text,
  country text,
  producer_similarity float,
  wine_name_similarity float,
  grape_similarity float,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  WITH scored AS (
    SELECT
      w.id,
      w.producer,
      w.wine_name,
      w.grape_variety,
      w.region,
      w.country,
      similarity(w.producer, query_producer) AS producer_similarity,
      similarity(w.wine_name, query_wine_name) AS wine_name_similarity,
      CASE
        WHEN query_grape_variety IS NULL OR nullif(query_grape_variety, '') IS NULL OR w.grape_variety IS NULL
          THEN 0::float
        ELSE similarity(w.grape_variety, query_grape_variety)
      END AS grape_similarity
    FROM public.wines w
  )
  SELECT
    id,
    producer,
    wine_name,
    grape_variety,
    region,
    country,
    producer_similarity,
    wine_name_similarity,
    grape_similarity,
    (
      producer_similarity * 0.3 +
      wine_name_similarity * 0.6 +
      grape_similarity * 0.1
    ) AS similarity
  FROM scored
  WHERE
    producer_similarity > similarity_threshold
    OR wine_name_similarity > similarity_threshold
    OR grape_similarity > similarity_threshold
  ORDER BY
    (
      producer_similarity * 0.3 +
      wine_name_similarity * 0.6 +
      grape_similarity * 0.1
    ) DESC,
    wine_name_similarity DESC,
    producer_similarity DESC
  LIMIT 8;
$$;

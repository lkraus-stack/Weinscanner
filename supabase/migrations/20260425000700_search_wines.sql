SET search_path = public, extensions;

CREATE INDEX IF NOT EXISTS idx_wines_wine_name_trgm
  ON public.wines
  USING gin (wine_name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_wines(
  query_producer text,
  query_wine_name text,
  similarity_threshold float DEFAULT 0.4
)
RETURNS TABLE (
  id uuid,
  producer text,
  wine_name text,
  region text,
  country text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    w.id,
    w.producer,
    w.wine_name,
    w.region,
    w.country,
    GREATEST(
      similarity(w.producer, query_producer),
      similarity(w.wine_name, query_wine_name)
    ) AS similarity
  FROM public.wines w
  WHERE
    similarity(w.producer, query_producer) > similarity_threshold
    OR similarity(w.wine_name, query_wine_name) > similarity_threshold
  ORDER BY
    (
      similarity(w.producer, query_producer) +
      similarity(w.wine_name, query_wine_name)
    ) DESC
  LIMIT 5;
$$;

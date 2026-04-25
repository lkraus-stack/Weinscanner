SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.get_user_scan_history(
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 20,
  wine_color_filter text DEFAULT null,
  search_query text DEFAULT null
)
RETURNS TABLE (
  scan_id uuid,
  scanned_at timestamptz,
  label_image_path text,
  vintage_id uuid,
  vintage_year int,
  wine_id uuid,
  producer text,
  wine_name text,
  region text,
  country text,
  wine_color text,
  grape_variety text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id AS scan_id,
    s.scanned_at,
    s.label_image_url AS label_image_path,
    v.id AS vintage_id,
    v.vintage_year,
    w.id AS wine_id,
    w.producer,
    w.wine_name,
    w.region,
    w.country,
    w.wine_color,
    w.grape_variety
  FROM public.scans s
  JOIN public.vintages v ON v.id = s.vintage_id
  JOIN public.wines w ON w.id = v.wine_id
  WHERE s.user_id = auth.uid()
    AND (
      wine_color_filter IS NULL
      OR (
        wine_color_filter IN ('weiss', 'rot', 'rose', 'schaum', 'suess')
        AND w.wine_color = wine_color_filter
      )
    )
    AND (
      nullif(trim(search_query), '') IS NULL
      OR to_tsvector('german', coalesce(w.search_text, '')) @@ plainto_tsquery('german', search_query)
      OR w.search_text ILIKE '%' || search_query || '%'
      OR w.grape_variety ILIKE '%' || search_query || '%'
    )
  ORDER BY s.scanned_at DESC
  OFFSET greatest(page_offset, 0)
  LIMIT least(greatest(page_limit, 1), 50);
$$;

REVOKE ALL ON FUNCTION public.get_user_scan_history(int, int, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_scan_history(int, int, text, text) TO authenticated;

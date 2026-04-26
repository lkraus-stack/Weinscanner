CREATE OR REPLACE FUNCTION public.get_user_inventory_with_photos(
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 20,
  storage_location_filter text DEFAULT NULL,
  hide_empty_inventory boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  vintage_id uuid,
  quantity int,
  storage_location text,
  purchased_at date,
  purchase_price numeric,
  notes text,
  created_at timestamptz,
  vintage_year int,
  wine_id uuid,
  producer text,
  wine_name text,
  region text,
  country text,
  wine_color text,
  image_path text,
  latest_scan_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ii.id,
    ii.vintage_id,
    ii.quantity,
    ii.storage_location,
    ii.purchased_at,
    ii.purchase_price,
    ii.notes,
    ii.created_at,
    v.vintage_year,
    w.id AS wine_id,
    w.producer,
    w.wine_name,
    w.region,
    w.country,
    w.wine_color,
    latest_scan.label_image_url AS image_path,
    latest_scan.id AS latest_scan_id
  FROM public.inventory_items ii
  JOIN public.vintages v
    ON v.id = ii.vintage_id
  JOIN public.wines w
    ON w.id = v.wine_id
  LEFT JOIN LATERAL (
    SELECT
      s.id,
      s.label_image_url
    FROM public.scans s
    WHERE s.user_id = auth.uid()
      AND s.vintage_id = ii.vintage_id
    ORDER BY s.scanned_at DESC
    LIMIT 1
  ) latest_scan ON true
  WHERE ii.user_id = auth.uid()
    AND (
      storage_location_filter IS NULL
      OR ii.storage_location = storage_location_filter
    )
    AND (
      hide_empty_inventory IS NOT TRUE
      OR coalesce(ii.quantity, 0) > 0
    )
  ORDER BY ii.created_at DESC
  OFFSET greatest(page_offset, 0)
  LIMIT least(greatest(page_limit, 1), 100);
$$;

REVOKE ALL ON FUNCTION public.get_user_inventory_with_photos(int, int, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_inventory_with_photos(int, int, text, boolean) TO authenticated;

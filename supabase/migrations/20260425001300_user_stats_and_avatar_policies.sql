SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.user_stats(p_user_id uuid)
RETURNS TABLE (
  scan_count bigint,
  rating_count bigint,
  distinct_regions bigint,
  top_region text,
  top_grape_variety text,
  total_bottles bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH
  scans_data AS (
    SELECT s.id, w.region, w.grape_variety
    FROM public.scans s
    JOIN public.vintages v ON v.id = s.vintage_id
    JOIN public.wines w ON w.id = v.wine_id
    WHERE s.user_id = p_user_id
      AND p_user_id = auth.uid()
  ),
  top_region_calc AS (
    SELECT region
    FROM scans_data
    WHERE region IS NOT NULL
      AND trim(region) <> ''
    GROUP BY region
    ORDER BY count(*) DESC, region ASC
    LIMIT 1
  ),
  top_grape_calc AS (
    SELECT grape_variety
    FROM scans_data
    WHERE grape_variety IS NOT NULL
      AND trim(grape_variety) <> ''
    GROUP BY grape_variety
    ORDER BY count(*) DESC, grape_variety ASC
    LIMIT 1
  )
  SELECT
    (SELECT count(*) FROM scans_data)::bigint,
    (
      SELECT count(*)
      FROM public.ratings
      WHERE user_id = p_user_id
        AND p_user_id = auth.uid()
    )::bigint,
    (
      SELECT count(DISTINCT region)
      FROM scans_data
      WHERE region IS NOT NULL
        AND trim(region) <> ''
    )::bigint,
    (SELECT region FROM top_region_calc),
    (SELECT grape_variety FROM top_grape_calc),
    (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.inventory_items
      WHERE user_id = p_user_id
        AND p_user_id = auth.uid()
    )::bigint;
$$;

REVOKE ALL ON FUNCTION public.user_stats(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.user_stats(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own avatar'
  ) THEN
    CREATE POLICY "Users can update own avatar" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own avatar'
  ) THEN
    CREATE POLICY "Users can delete own avatar" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;

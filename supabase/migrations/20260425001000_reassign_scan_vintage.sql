CREATE OR REPLACE FUNCTION public.reassign_scan_vintage(
  scan_id uuid,
  target_vintage_year int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_scan record;
  v_target_vintage_id uuid;
  v_wine_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert.';
  END IF;

  IF target_vintage_year IS NULL
    OR target_vintage_year < 1900
    OR target_vintage_year > extract(year FROM now())::int + 1 THEN
    RAISE EXCEPTION 'Ungültiger Jahrgang.';
  END IF;

  SELECT s.id, s.vintage_id
    INTO v_scan
  FROM public.scans s
  WHERE s.id = reassign_scan_vintage.scan_id
    AND s.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scan nicht gefunden.';
  END IF;

  SELECT v.wine_id
    INTO v_wine_id
  FROM public.vintages v
  WHERE v.id = v_scan.vintage_id;

  IF v_wine_id IS NULL THEN
    RAISE EXCEPTION 'Wein zum Scan nicht gefunden.';
  END IF;

  SELECT v.id
    INTO v_target_vintage_id
  FROM public.vintages v
  WHERE v.wine_id = v_wine_id
    AND v.vintage_year = reassign_scan_vintage.target_vintage_year;

  IF v_target_vintage_id IS NULL THEN
    INSERT INTO public.vintages (wine_id, vintage_year)
    VALUES (v_wine_id, reassign_scan_vintage.target_vintage_year)
    ON CONFLICT (wine_id, vintage_year) DO UPDATE
      SET wine_id = EXCLUDED.wine_id
    RETURNING id INTO v_target_vintage_id;
  END IF;

  UPDATE public.scans
  SET vintage_id = v_target_vintage_id
  WHERE id = reassign_scan_vintage.scan_id
    AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'scanId', reassign_scan_vintage.scan_id,
    'vintageId', v_target_vintage_id,
    'vintageYear', reassign_scan_vintage.target_vintage_year,
    'wineId', v_wine_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_scan_vintage(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.reassign_scan_vintage(uuid, int) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own labels'
  ) THEN
    CREATE POLICY "Users can delete own labels" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'wine-labels'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END;
$$;

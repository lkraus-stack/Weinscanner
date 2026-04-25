SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.save_scan_atomic(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source text := payload->>'source';
  v_wine_id uuid;
  v_vintage_id uuid;
  v_scan_id uuid;
  v_storage_path text := nullif(payload->>'storagePath', '');
  v_bottle_storage_path text := nullif(payload->>'bottleStoragePath', '');
  v_selected_year int;
  v_wine_data jsonb := coalesce(payload->'wineData', '{}'::jsonb);
  v_vintage_data jsonb := coalesce(payload->'vintageData', '{}'::jsonb);
  v_corrections jsonb := coalesce(payload->'corrections', '[]'::jsonb);
  v_correction jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt.';
  END IF;

  IF v_storage_path IS NULL THEN
    RAISE EXCEPTION 'storagePath fehlt.';
  END IF;

  IF v_source NOT IN ('cache', 'fresh', 'manual') THEN
    RAISE EXCEPTION 'Ungültige Quelle.';
  END IF;

  BEGIN
    v_selected_year := (payload->>'selectedVintageYear')::int;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Bitte wähle einen gültigen Jahrgang.';
  END;

  IF v_selected_year < 1900 OR v_selected_year > extract(year from now())::int + 1 THEN
    RAISE EXCEPTION 'Bitte wähle einen gültigen Jahrgang.';
  END IF;

  IF v_source IN ('cache', 'fresh') AND nullif(payload->>'wineId', '') IS NOT NULL THEN
    v_wine_id := (payload->>'wineId')::uuid;

    IF NOT EXISTS (SELECT 1 FROM public.wines WHERE id = v_wine_id) THEN
      RAISE EXCEPTION 'Wein wurde nicht gefunden.';
    END IF;
  END IF;

  IF v_source = 'cache' THEN
    IF v_wine_id IS NULL THEN
      RAISE EXCEPTION 'wineId fehlt.';
    END IF;
  ELSIF v_source = 'fresh' AND v_wine_id IS NOT NULL THEN
    UPDATE public.wines
    SET
      producer = coalesce(nullif(v_wine_data->>'producer', ''), producer),
      wine_name = coalesce(nullif(v_wine_data->>'wine_name', ''), wine_name),
      region = CASE WHEN v_wine_data ? 'region' THEN nullif(v_wine_data->>'region', '') ELSE region END,
      country = CASE WHEN v_wine_data ? 'country' THEN nullif(v_wine_data->>'country', '') ELSE country END,
      appellation = CASE WHEN v_wine_data ? 'appellation' THEN nullif(v_wine_data->>'appellation', '') ELSE appellation END,
      grape_variety = CASE WHEN v_wine_data ? 'grape_variety' THEN nullif(v_wine_data->>'grape_variety', '') ELSE grape_variety END,
      wine_color = CASE WHEN v_wine_data ? 'wine_color' THEN nullif(v_wine_data->>'wine_color', '') ELSE wine_color END,
      taste_dryness = CASE WHEN v_wine_data ? 'taste_dryness' THEN nullif(v_wine_data->>'taste_dryness', '') ELSE taste_dryness END,
      updated_at = now()
    WHERE id = v_wine_id;
  ELSE
    IF nullif(v_wine_data->>'producer', '') IS NULL
      OR nullif(v_wine_data->>'wine_name', '') IS NULL THEN
      RAISE EXCEPTION 'Weingut und Weinname sind Pflichtfelder.';
    END IF;

    INSERT INTO public.wines (
      producer,
      wine_name,
      region,
      country,
      appellation,
      grape_variety,
      wine_color,
      taste_dryness
    )
    VALUES (
      nullif(v_wine_data->>'producer', ''),
      nullif(v_wine_data->>'wine_name', ''),
      nullif(v_wine_data->>'region', ''),
      nullif(v_wine_data->>'country', ''),
      nullif(v_wine_data->>'appellation', ''),
      nullif(v_wine_data->>'grape_variety', ''),
      nullif(v_wine_data->>'wine_color', ''),
      nullif(v_wine_data->>'taste_dryness', '')
    )
    RETURNING id INTO v_wine_id;
  END IF;

  SELECT id INTO v_vintage_id
  FROM public.vintages
  WHERE wine_id = v_wine_id
    AND vintage_year = v_selected_year;

  IF v_vintage_id IS NULL THEN
    INSERT INTO public.vintages (
      wine_id,
      vintage_year,
      drinking_window_start,
      drinking_window_end,
      price_min_eur,
      price_max_eur,
      alcohol_percent,
      aromas,
      description_short,
      description_long,
      food_pairing,
      serving_temperature,
      vinification,
      ai_confidence,
      data_sources
    )
    VALUES (
      v_wine_id,
      v_selected_year,
      nullif(v_vintage_data->>'drinking_window_start', '')::int,
      nullif(v_vintage_data->>'drinking_window_end', '')::int,
      nullif(v_vintage_data->>'price_min_eur', '')::numeric,
      nullif(v_vintage_data->>'price_max_eur', '')::numeric,
      coalesce(
        nullif(v_vintage_data->>'alcohol_percent', '')::numeric,
        nullif(v_wine_data->>'alcohol_percent', '')::numeric
      ),
      CASE
        WHEN jsonb_typeof(v_vintage_data->'aromas') = 'array'
          THEN v_vintage_data->'aromas'
        ELSE '[]'::jsonb
      END,
      nullif(v_vintage_data->>'description_short', ''),
      nullif(v_vintage_data->>'description_long', ''),
      nullif(v_vintage_data->>'food_pairing', ''),
      nullif(v_vintage_data->>'serving_temperature', ''),
      nullif(v_vintage_data->>'vinification', ''),
      nullif(v_vintage_data->>'ai_confidence', '')::numeric,
      CASE
        WHEN jsonb_typeof(v_vintage_data->'data_sources') = 'array'
          THEN v_vintage_data->'data_sources'
        ELSE '[]'::jsonb
      END
    )
    RETURNING id INTO v_vintage_id;
  END IF;

  INSERT INTO public.scans (
    user_id,
    vintage_id,
    label_image_url,
    bottle_image_url
  )
  VALUES (
    v_user_id,
    v_vintage_id,
    v_storage_path,
    v_bottle_storage_path
  )
  RETURNING id INTO v_scan_id;

  IF jsonb_typeof(v_corrections) = 'array' THEN
    FOR v_correction IN SELECT value FROM jsonb_array_elements(v_corrections)
    LOOP
      IF nullif(v_correction->>'field', '') IS NOT NULL
        AND coalesce(v_correction->>'ai_value', '') IS DISTINCT FROM coalesce(v_correction->>'user_value', '') THEN
        INSERT INTO public.ai_feedback (
          user_id,
          scan_id,
          field,
          ai_value,
          user_value
        )
        VALUES (
          v_user_id,
          v_scan_id,
          v_correction->>'field',
          v_correction->>'ai_value',
          v_correction->>'user_value'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'scanId', v_scan_id,
    'wineId', v_wine_id,
    'vintageId', v_vintage_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_scan_atomic(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.save_scan_atomic(jsonb) TO authenticated;

SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.wines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer text NOT NULL,
  wine_name text NOT NULL,
  region text,
  sub_region text,
  country text,
  appellation text,
  grape_variety text,
  wine_color text CHECK (wine_color IN ('weiss', 'rot', 'rose', 'schaum', 'suess')),
  taste_dryness text CHECK (taste_dryness IN ('trocken', 'halbtrocken', 'lieblich', 'suess')),
  embedding vector(1536),
  search_text text GENERATED ALWAYS AS (
    coalesce(producer, '') || ' ' ||
    coalesce(wine_name, '') || ' ' ||
    coalesce(region, '') || ' ' ||
    coalesce(country, '')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vintages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id uuid NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  vintage_year int NOT NULL,
  drinking_window_start int,
  drinking_window_end int,
  price_min_eur numeric(10, 2),
  price_max_eur numeric(10, 2),
  alcohol_percent numeric(4, 2),
  aromas jsonb DEFAULT '[]'::jsonb,
  description_short text,
  description_long text,
  food_pairing text,
  serving_temperature text,
  vinification text,
  ai_confidence numeric(3, 2) CHECK (
    ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)
  ),
  data_sources jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wine_id, vintage_year)
);

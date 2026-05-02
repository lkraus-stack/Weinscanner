CREATE TABLE IF NOT EXISTS public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('fallback', 'google_places')),
  provider_place_id text NOT NULL,
  name text NOT NULL,
  formatted_address text,
  city text,
  country text,
  latitude numeric(10, 7) NOT NULL,
  longitude numeric(10, 7) NOT NULL,
  rating numeric(3, 2),
  rating_count int,
  price_level text,
  cuisine text,
  place_types text[] DEFAULT '{}'::text[],
  phone text,
  website_url text,
  google_maps_uri text,
  photo_refs jsonb DEFAULT '[]'::jsonb,
  opening_hours jsonb,
  source_payload jsonb,
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_place_id)
);

CREATE INDEX IF NOT EXISTS restaurants_provider_place_idx
  ON public.restaurants (provider, provider_place_id);

CREATE INDEX IF NOT EXISTS restaurants_location_idx
  ON public.restaurants (latitude, longitude);

CREATE TABLE IF NOT EXISTS public.restaurant_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('fallback', 'google_places')),
  query_hash text NOT NULL UNIQUE,
  center_lat numeric(10, 7) NOT NULL,
  center_lng numeric(10, 7) NOT NULL,
  bounds jsonb NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  restaurant_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);

CREATE INDEX IF NOT EXISTS restaurant_search_cache_expires_idx
  ON public.restaurant_search_cache (expires_at);

CREATE TABLE IF NOT EXISTS public.saved_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS saved_restaurants_user_idx
  ON public.saved_restaurants (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.restaurant_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  overall_stars int NOT NULL CHECK (overall_stars BETWEEN 1 AND 5),
  wine_stars int NOT NULL CHECK (wine_stars BETWEEN 1 AND 5),
  notes text,
  visited_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS restaurant_ratings_user_idx
  ON public.restaurant_ratings (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.restaurant_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  vintage_id uuid REFERENCES public.vintages(id) ON DELETE SET NULL,
  visited_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS restaurant_visits_user_idx
  ON public.restaurant_visits (user_id, visited_at DESC);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_visits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurants'
      AND policyname = 'Authenticated users can read restaurants'
  ) THEN
    CREATE POLICY "Authenticated users can read restaurants"
      ON public.restaurants FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_restaurants'
      AND policyname = 'Users can manage own saved restaurants'
  ) THEN
    CREATE POLICY "Users can manage own saved restaurants"
      ON public.saved_restaurants FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_ratings'
      AND policyname = 'Users can manage own restaurant ratings'
  ) THEN
    CREATE POLICY "Users can manage own restaurant ratings"
      ON public.restaurant_ratings FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_visits'
      AND policyname = 'Users can manage own restaurant visits'
  ) THEN
    CREATE POLICY "Users can manage own restaurant visits"
      ON public.restaurant_visits FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (
        auth.uid() = user_id
        AND (
          inventory_item_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.inventory_items
            WHERE inventory_items.id = restaurant_visits.inventory_item_id
              AND inventory_items.user_id = auth.uid()
          )
        )
      );
  END IF;
END;
$$;

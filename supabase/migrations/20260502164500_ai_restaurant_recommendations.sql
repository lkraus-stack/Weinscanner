CREATE TABLE IF NOT EXISTS public.restaurant_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider_place_id text NOT NULL,
  occasion text NOT NULL,
  analysis_version text NOT NULL DEFAULT 'v1',
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  role_label text NOT NULL,
  headline text NOT NULL,
  reason text NOT NULL,
  strengths text[] NOT NULL DEFAULT '{}'::text[],
  watchouts text[] NOT NULL DEFAULT '{}'::text[],
  review_signals text[] NOT NULL DEFAULT '{}'::text[],
  wine_fit text,
  matching_inventory_item_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id, occasion, analysis_version)
);

CREATE INDEX IF NOT EXISTS restaurant_ai_analyses_user_idx
  ON public.restaurant_ai_analyses (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_ai_analyses_restaurant_idx
  ON public.restaurant_ai_analyses (restaurant_id, occasion, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.restaurant_recommendation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  occasion text NOT NULL,
  analysis_version text NOT NULL DEFAULT 'v1',
  context_label text NOT NULL,
  center_lat numeric,
  center_lng numeric,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_restaurant_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  recommendation_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_hash)
);

CREATE INDEX IF NOT EXISTS restaurant_recommendation_runs_user_idx
  ON public.restaurant_recommendation_runs (user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_recommendation_runs_expires_idx
  ON public.restaurant_recommendation_runs (expires_at);

ALTER TABLE public.restaurant_ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_recommendation_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_ai_analyses'
      AND policyname = 'Users can read own restaurant AI analyses'
  ) THEN
    CREATE POLICY "Users can read own restaurant AI analyses"
      ON public.restaurant_ai_analyses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_recommendation_runs'
      AND policyname = 'Users can read own restaurant recommendation runs'
  ) THEN
    CREATE POLICY "Users can read own restaurant recommendation runs"
      ON public.restaurant_recommendation_runs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

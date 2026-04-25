SET search_path = public, extensions;

CREATE INDEX IF NOT EXISTS idx_wines_embedding
  ON public.wines
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wines_search
  ON public.wines
  USING gin (to_tsvector('german', search_text));

CREATE INDEX IF NOT EXISTS idx_wines_producer_trgm
  ON public.wines
  USING gin (producer gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_scans_user
  ON public.scans (user_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_user
  ON public.inventory_items (user_id);

CREATE INDEX IF NOT EXISTS idx_ratings_user
  ON public.ratings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vintages_wine
  ON public.vintages (wine_id);

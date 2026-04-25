SET search_path = public, extensions;

ALTER TABLE public.inventory_items
  ALTER COLUMN user_id SET DEFAULT auth.uid();

UPDATE public.inventory_items
SET quantity = 0
WHERE quantity IS NOT NULL
  AND quantity < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_items_quantity_nonnegative'
      AND conrelid = 'public.inventory_items'::regclass
  ) THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_quantity_nonnegative
      CHECK (quantity IS NULL OR quantity >= 0);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_inventory_quantity(item_id uuid)
RETURNS public.inventory_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.inventory_items;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt.';
  END IF;

  UPDATE public.inventory_items
  SET quantity = greatest(coalesce(quantity, 0) - 1, 0)
  WHERE id = item_id
    AND user_id = v_user_id
  RETURNING * INTO v_item;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Bestandseintrag wurde nicht gefunden.';
  END IF;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_inventory_quantity(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.decrement_inventory_quantity(uuid) TO authenticated;

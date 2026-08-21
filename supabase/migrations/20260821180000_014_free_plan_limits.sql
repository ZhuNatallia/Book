-- Free limits: 30 recipes, 5 URL imports per calendar month.
-- Keep in sync with src/lib/plan.ts
-- 013 already applied: this replaces the trigger functions only.

CREATE OR REPLACE FUNCTION public.enforce_recipe_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = NEW.id) THEN
    RETURN NEW;
  END IF;
  IF public.has_plus(NEW.user_id) THEN
    RETURN NEW;
  END IF;
  SELECT count(*)::int INTO n FROM public.recipes r WHERE r.user_id = NEW.user_id;
  IF n >= 30 THEN
    RAISE EXCEPTION 'recipe_limit_reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_import_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF public.has_plus(NEW.user_id) THEN
    RETURN NEW;
  END IF;
  SELECT count(*)::int INTO n
  FROM public.recipe_imports i
  WHERE i.user_id = NEW.user_id
    AND i.created_at >= date_trunc('month', now());
  IF n >= 5 THEN
    RAISE EXCEPTION 'import_limit_reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

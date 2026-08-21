-- Plans: Free vs Plus. Limits later set to 30 recipes / 5 imports in 014.
-- Billing columns live on `subscriptions` so friends cannot see Stripe IDs.
-- Authenticated users may SELECT their row; plan changes are service_role / SQL only.
-- Apply in Supabase SQL Editor if CLI deploy is blocked (same as 011 / 012).
-- Keep limits in sync with src/lib/plan.ts

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus')),
  period text CHECK (period IS NULL OR period IN ('month', 'year')),
  valid_until timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipe_imports_user_created_idx
  ON public.recipe_imports (user_id, created_at DESC);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscription" ON public.subscriptions;
CREATE POLICY "select_own_subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_import" ON public.recipe_imports;
CREATE POLICY "insert_own_import" ON public.recipe_imports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "select_own_imports" ON public.recipe_imports;
CREATE POLICY "select_own_imports" ON public.recipe_imports FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON TABLE public.subscriptions TO authenticated;
GRANT INSERT, SELECT ON TABLE public.recipe_imports TO authenticated;

INSERT INTO public.subscriptions (user_id)
SELECT p.id FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.subscriptions (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_plus(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = uid
      AND s.plan = 'plus'
      AND s.valid_until IS NOT NULL
      AND s.valid_until > now()
  );
$$;

REVOKE ALL ON FUNCTION public.has_plus(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_plus(uuid) TO authenticated;

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

DROP TRIGGER IF EXISTS recipes_enforce_limit ON public.recipes;
CREATE TRIGGER recipes_enforce_limit
  BEFORE INSERT ON public.recipes
  FOR EACH ROW EXECUTE PROCEDURE public.enforce_recipe_limit();

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

DROP TRIGGER IF EXISTS recipe_imports_enforce_limit ON public.recipe_imports;
CREATE TRIGGER recipe_imports_enforce_limit
  BEFORE INSERT ON public.recipe_imports
  FOR EACH ROW EXECUTE PROCEDURE public.enforce_import_limit();

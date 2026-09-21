-- Friend circles (friends / family / close) and per-circle recipe visibility.

ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS circle TEXT NOT NULL DEFAULT 'friends';

ALTER TABLE friendships
  DROP CONSTRAINT IF EXISTS friendships_circle_check;

ALTER TABLE friendships
  ADD CONSTRAINT friendships_circle_check
  CHECK (circle IN ('friends', 'family', 'close'));

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS visible_circles TEXT[] NOT NULL DEFAULT ARRAY['friends', 'family', 'close']::text[];

UPDATE recipes
SET visible_circles = ARRAY[]::text[]
WHERE visible_to_friends = false
  AND cardinality(visible_circles) > 0;

UPDATE recipes
SET visible_circles = ARRAY['friends', 'family', 'close']::text[]
WHERE visible_to_friends = true
  AND cardinality(visible_circles) = 0;

DROP POLICY IF EXISTS "select_own_or_visible_friend_recipes" ON recipes;
CREATE POLICY "select_own_or_visible_friend_recipes" ON recipes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      visible_to_friends = true
      AND cardinality(visible_circles) > 0
      AND EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.user_id = auth.uid()
          AND f.friend_id = recipes.user_id
          AND f.circle = ANY (recipes.visible_circles)
      )
    )
  );

CREATE OR REPLACE FUNCTION public.set_recipe_visible(recipe_id uuid, visible boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.recipes
  SET visible_to_friends = visible,
      visible_circles = CASE
        WHEN visible THEN ARRAY['friends', 'family', 'close']::text[]
        ELSE ARRAY[]::text[]
      END,
      updated_at = now()
  WHERE id = recipe_id
    AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipe not found';
  END IF;
  RETURN visible;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_recipe_visibility(
  recipe_id uuid,
  visible boolean,
  circles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_circles text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT visible THEN
    next_circles := ARRAY[]::text[];
  ELSE
    SELECT coalesce(array_agg(c), ARRAY['friends', 'family', 'close']::text[])
    INTO next_circles
    FROM unnest(coalesce(circles, ARRAY['friends', 'family', 'close']::text[])) AS c
    WHERE c IN ('friends', 'family', 'close');

    IF next_circles IS NULL OR cardinality(next_circles) = 0 THEN
      next_circles := ARRAY['friends', 'family', 'close']::text[];
    END IF;
  END IF;

  UPDATE public.recipes
  SET visible_to_friends = (cardinality(next_circles) > 0),
      visible_circles = next_circles,
      updated_at = now()
  WHERE id = recipe_id
    AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipe not found';
  END IF;
  RETURN cardinality(next_circles) > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.set_recipe_visible(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_recipe_visible(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.set_recipe_visibility(uuid, boolean, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_recipe_visibility(uuid, boolean, text[]) TO authenticated;

-- Dedicated write for the friends-eye so a later full recipe upsert cannot
-- silently drop visible_to_friends, and PostgREST updates that match 0 rows
-- no longer look like success.

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
      updated_at = now()
  WHERE id = recipe_id
    AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recipe not found';
  END IF;
  RETURN visible;
END;
$$;

REVOKE ALL ON FUNCTION public.set_recipe_visible(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_recipe_visible(uuid, boolean) TO authenticated;

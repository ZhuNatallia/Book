-- Mark copies so unfriending can optionally drop them, and allow both sides
-- of a friendship to be removed (INSERT is already RPC-only).

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS copied_from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recipes_copied_from_user_idx
  ON recipes (user_id, copied_from_user_id)
  WHERE copied_from_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.remove_friend(target uuid, keep_copies boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF target IS NULL OR target = auth.uid() THEN
    RAISE EXCEPTION 'cannot unfriend self';
  END IF;

  DELETE FROM friendships
  WHERE (user_id = auth.uid() AND friend_id = target)
     OR (user_id = target AND friend_id = auth.uid());

  IF NOT keep_copies THEN
    DELETE FROM recipes
    WHERE user_id = auth.uid()
      AND copied_from_user_id = target;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friend(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid, boolean) TO authenticated;

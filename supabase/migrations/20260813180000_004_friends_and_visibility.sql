-- Friends, profiles, recipe visibility

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS visible_to_friends BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower
  ON profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_digits
  ON profiles (regexp_replace(phone, '\D', '', 'g'))
  WHERE phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') <> '';

CREATE TABLE IF NOT EXISTS friendships (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS friendships_friend_id_idx ON friendships (friend_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_or_friends_profiles" ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.user_id = auth.uid() AND f.friend_id = profiles.id
    )
  );

CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "select_own_friendships" ON friendships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

INSERT INTO profiles (id, email, display_name)
SELECT
  u.id,
  u.email,
  split_part(COALESCE(u.email, ''), '@', 1)
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.find_profile(query text)
RETURNS TABLE (id uuid, email text, phone text, display_name text, avatar_url text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := lower(trim(query));
  digits text := regexp_replace(query, '\D', '', 'g');
BEGIN
  IF auth.uid() IS NULL OR q = '' THEN
    RETURN;
  END IF;

  IF position('@' in q) > 0 THEN
    RETURN QUERY
      SELECT p.id, p.email, p.phone, p.display_name, p.avatar_url
      FROM profiles p
      WHERE p.id <> auth.uid() AND lower(p.email) = q
      LIMIT 1;
  ELSIF length(digits) >= 7 THEN
    RETURN QUERY
      SELECT p.id, p.email, p.phone, p.display_name, p.avatar_url
      FROM profiles p
      WHERE p.id <> auth.uid()
        AND regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') = digits
      LIMIT 1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_friend(target uuid)
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
    RAISE EXCEPTION 'cannot friend self';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = target) THEN
    RAISE EXCEPTION 'user not found';
  END IF;
  INSERT INTO friendships (user_id, friend_id) VALUES (auth.uid(), target)
    ON CONFLICT DO NOTHING;
  INSERT INTO friendships (user_id, friend_id) VALUES (target, auth.uid())
    ON CONFLICT DO NOTHING;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON TABLE profiles TO authenticated;
GRANT SELECT ON TABLE friendships TO authenticated;
REVOKE ALL ON FUNCTION public.find_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_friend(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_friend(uuid) TO authenticated;

DROP POLICY IF EXISTS "select_own_recipes" ON recipes;
CREATE POLICY "select_own_or_visible_friend_recipes" ON recipes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      visible_to_friends = true
      AND EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.user_id = auth.uid() AND f.friend_id = recipes.user_id
      )
    )
  );

DROP POLICY IF EXISTS "select_own_recipe_translations" ON recipe_translations;
CREATE POLICY "select_visible_recipe_translations" ON recipe_translations FOR SELECT TO authenticated
  USING (recipe_id IN (SELECT id FROM recipes));

DROP POLICY IF EXISTS "select_own_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "select_visible_recipe_ingredients" ON recipe_ingredients FOR SELECT TO authenticated
  USING (recipe_id IN (SELECT id FROM recipes));

DROP POLICY IF EXISTS "select_own_ingredient_translations" ON ingredient_translations;
CREATE POLICY "select_visible_ingredient_translations" ON ingredient_translations FOR SELECT TO authenticated
  USING (ingredient_id IN (SELECT id FROM recipe_ingredients));

DROP POLICY IF EXISTS "select_own_recipe_steps" ON recipe_steps;
CREATE POLICY "select_visible_recipe_steps" ON recipe_steps FOR SELECT TO authenticated
  USING (recipe_id IN (SELECT id FROM recipes));

DROP POLICY IF EXISTS "select_own_step_translations" ON step_translations;
CREATE POLICY "select_visible_step_translations" ON step_translations FOR SELECT TO authenticated
  USING (step_id IN (SELECT id FROM recipe_steps));

-- Profile username, local friend nickname, find by @handle

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower
  ON profiles (lower(username))
  WHERE username IS NOT NULL AND username <> '';

ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS nickname TEXT;

DROP POLICY IF EXISTS "update_own_friendships" ON friendships;
CREATE POLICY "update_own_friendships" ON friendships FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT UPDATE ON TABLE friendships TO authenticated;

DROP FUNCTION IF EXISTS public.find_profile(text);

CREATE FUNCTION public.find_profile(query text)
RETURNS TABLE (
  id uuid,
  email text,
  phone text,
  display_name text,
  avatar_url text,
  username text
)
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

  IF left(q, 1) = '@' THEN
    q := substring(q from 2);
  END IF;

  IF position('@' in q) > 0 THEN
    RETURN QUERY
      SELECT p.id, p.email, p.phone, p.display_name, p.avatar_url, p.username
      FROM profiles p
      WHERE p.id <> auth.uid() AND lower(p.email) = q
      LIMIT 1;
  ELSIF length(digits) >= 7 AND q ~ '^[+0-9().\s-]+$' THEN
    RETURN QUERY
      SELECT p.id, p.email, p.phone, p.display_name, p.avatar_url, p.username
      FROM profiles p
      WHERE p.id <> auth.uid()
        AND regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') = digits
      LIMIT 1;
  ELSE
    RETURN QUERY
      SELECT p.id, p.email, p.phone, p.display_name, p.avatar_url, p.username
      FROM profiles p
      WHERE p.id <> auth.uid() AND lower(COALESCE(p.username, '')) = q
      LIMIT 1;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.find_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profile(text) TO authenticated;

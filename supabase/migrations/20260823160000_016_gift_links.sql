-- Named gift links that grant Plus for a number of days.
-- Apply in Supabase SQL Editor.
-- Users cannot write subscriptions; redeem_gift is SECURITY DEFINER.
--
-- Create a gift (copy the token into ?gift= ):
-- INSERT INTO public.gift_links (token, label, days, max_redemptions, expires_at)
-- VALUES (
--   'maria-' || substr(md5(random()::text), 1, 8),
--   'Мария',
--   90,
--   1,
--   now() + interval '60 days'
-- )
-- RETURNING token, label, days;

CREATE TABLE IF NOT EXISTS public.gift_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text,
  email text,
  days integer NOT NULL DEFAULT 90 CHECK (days > 0 AND days <= 3660),
  max_redemptions integer NOT NULL DEFAULT 1 CHECK (max_redemptions > 0),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gift_links_token_fmt CHECK (token ~ '^[a-z0-9][a-z0-9-]{3,63}$')
);

CREATE TABLE IF NOT EXISTS public.gift_redemptions (
  gift_id uuid NOT NULL REFERENCES public.gift_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (gift_id, user_id)
);

CREATE INDEX IF NOT EXISTS gift_redemptions_user_idx ON public.gift_redemptions (user_id);

ALTER TABLE public.gift_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_redemptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.peek_gift(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.gift_links%ROWTYPE;
  used int;
  tok text := lower(trim(p_token));
BEGIN
  IF tok IS NULL OR tok = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid');
  END IF;
  SELECT * INTO g FROM public.gift_links WHERE token = tok;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid');
  END IF;
  IF g.expires_at IS NOT NULL AND g.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'status', 'expired', 'label', g.label);
  END IF;
  SELECT count(*)::int INTO used FROM public.gift_redemptions WHERE gift_id = g.id;
  IF used >= g.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'status', 'exhausted', 'label', g.label);
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'status', 'ready',
    'label', g.label,
    'days', g.days
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_gift(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  g public.gift_links%ROWTYPE;
  used int;
  new_until timestamptz;
  cur_until timestamptz;
  user_email text;
  tok text := lower(trim(p_token));
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'auth');
  END IF;
  IF tok IS NULL OR tok = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gift:' || tok));

  SELECT * INTO g FROM public.gift_links WHERE token = tok;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid');
  END IF;
  IF g.expires_at IS NOT NULL AND g.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'status', 'expired', 'label', g.label);
  END IF;

  SELECT count(*)::int INTO used FROM public.gift_redemptions WHERE gift_id = g.id;
  IF used >= g.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'status', 'exhausted', 'label', g.label);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gift_redemptions r
    WHERE r.gift_id = g.id AND r.user_id = uid
  ) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already', 'label', g.label);
  END IF;

  IF g.email IS NOT NULL AND length(trim(g.email)) > 0 THEN
    SELECT u.email INTO user_email FROM auth.users u WHERE u.id = uid;
    IF lower(trim(COALESCE(user_email, ''))) <> lower(trim(g.email)) THEN
      RETURN jsonb_build_object('ok', false, 'status', 'email', 'label', g.label);
    END IF;
  END IF;

  new_until := now() + make_interval(days => g.days);
  SELECT s.valid_until INTO cur_until FROM public.subscriptions s WHERE s.user_id = uid;
  IF public.has_plus(uid) AND cur_until IS NOT NULL AND cur_until >= new_until THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_plus', 'label', g.label);
  END IF;

  INSERT INTO public.gift_redemptions (gift_id, user_id) VALUES (g.id, uid);

  INSERT INTO public.subscriptions (user_id, plan, period, valid_until, provider, updated_at)
  VALUES (uid, 'plus', 'month', new_until, 'gift', now())
  ON CONFLICT (user_id) DO UPDATE SET
    plan = 'plus',
    period = COALESCE(public.subscriptions.period, 'month'),
    valid_until = GREATEST(COALESCE(public.subscriptions.valid_until, EXCLUDED.valid_until), EXCLUDED.valid_until),
    provider = 'gift',
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'ok',
    'label', g.label,
    'days', g.days,
    'valid_until', new_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.peek_gift(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_gift(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_gift(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_gift(text) TO authenticated;

REVOKE ALL ON TABLE public.gift_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.gift_redemptions FROM PUBLIC, anon, authenticated;

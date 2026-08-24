-- One 7-day Plus trial per account. No card; same path as gifts.
-- Users cannot write subscriptions; start_trial is SECURITY DEFINER.
-- Apply in Supabase SQL Editor.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.start_trial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur public.subscriptions%ROWTYPE;
  new_until timestamptz;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'auth');
  END IF;

  INSERT INTO public.subscriptions (user_id)
  VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO cur FROM public.subscriptions WHERE user_id = uid FOR UPDATE;

  IF cur.trial_started_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'already', 'days', 7);
  END IF;

  new_until := now() + interval '7 days';

  IF public.has_plus(uid) AND cur.valid_until IS NOT NULL AND cur.valid_until >= new_until THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_plus', 'days', 7);
  END IF;

  UPDATE public.subscriptions SET
    plan = 'plus',
    period = COALESCE(period, 'month'),
    valid_until = GREATEST(COALESCE(valid_until, new_until), new_until),
    provider = 'trial',
    trial_started_at = now(),
    updated_at = now()
  WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'ok',
    'days', 7,
    'valid_until', new_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_trial() TO authenticated;

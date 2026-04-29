-- Atomic invite-claim function
--
-- The client-side RLS policies cannot handle this flow cleanly:
--   • SELECT requires being a member  → can't find the pending row
--   • UPDATE requires being a member  → can't activate the row
--
-- A SECURITY DEFINER function runs as the owner (bypasses RLS) and lets us
-- enforce all guards — already-partnered, self-link, not-found — atomically
-- with a FOR UPDATE row-lock so two simultaneous claims can't both succeed.

CREATE OR REPLACE FUNCTION public.claim_partnership_invite(p_invite_code TEXT)
RETURNS public.partnerships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partnership public.partnerships;
BEGIN
  -- Guard: caller must not already be in an active partnership
  IF EXISTS (
    SELECT 1 FROM public.partnerships
    WHERE status = 'active'
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'already_partnered';
  END IF;

  -- Find + lock the pending row (prevents double-claim race)
  SELECT * INTO v_partnership
  FROM public.partnerships
  WHERE invite_code = upper(trim(p_invite_code))
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Guard: cannot claim your own invite
  IF v_partnership.user_a_id = auth.uid() THEN
    RAISE EXCEPTION 'self_link';
  END IF;

  -- Activate
  UPDATE public.partnerships
  SET
    user_b_id    = auth.uid(),
    status       = 'active',
    activated_at = NOW()
  WHERE id = v_partnership.id
  RETURNING * INTO v_partnership;

  RETURN v_partnership;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_partnership_invite(TEXT) TO authenticated;

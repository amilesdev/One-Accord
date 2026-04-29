-- Partnerships: allow authenticated users to read pending rows
--
-- The existing "partnerships: read as member" policy requires the caller to
-- already be user_a_id OR user_b_id. For a pending partnership user_b_id is
-- NULL, so the partner trying to claim an invite code can't see the row at
-- all — Supabase returns nothing and the API reports "not found".
--
-- This policy grants any authenticated user SELECT on pending partnerships so
-- the invite-claim flow can find the row by invite_code.

CREATE POLICY "partnerships: read pending for claiming"
  ON public.partnerships FOR SELECT
  USING (status = 'pending' AND auth.uid() IS NOT NULL);

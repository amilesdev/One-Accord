-- ============================================================
-- One Accord — Week Lifecycle Function
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
--
-- This function handles the full week creation atomically:
--   1. Verifies caller is an active member of the partnership
--   2. Locks any currently active week (sets it to 'completed')
--   3. Creates a new week record
--   4. Copies task definitions from the template into weekly_tasks
--   5. Initialises task_progress rows for BOTH users
--
-- SECURITY DEFINER is required so step 5 can insert progress rows
-- for the partner (RLS normally blocks inserting for other users).
-- The explicit membership check inside the function keeps it safe.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_week_for_partnership(
  p_partnership_id UUID,
  p_template_id    UUID,
  p_start_date     DATE,
  p_end_date       DATE
)
RETURNS public.weeks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week        public.weeks;
  v_task_def    JSONB;
  v_task        public.weekly_tasks;
  v_user_a_id   UUID;
  v_user_b_id   UUID;
BEGIN
  -- 1. Verify the caller is an active member of this partnership
  SELECT user_a_id, user_b_id
    INTO v_user_a_id, v_user_b_id
    FROM public.partnerships
   WHERE id        = p_partnership_id
     AND status    = 'active'
     AND (user_a_id = auth.uid() OR user_b_id = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'create_week: caller is not an active member of partnership %', p_partnership_id;
  END IF;

  IF v_user_b_id IS NULL THEN
    RAISE EXCEPTION 'create_week: partnership % has no second member yet', p_partnership_id;
  END IF;

  -- 2. Lock any currently active week for this partnership
  UPDATE public.weeks
     SET status = 'completed'
   WHERE partnership_id = p_partnership_id
     AND status         = 'active';

  -- 3. Create the new week
  INSERT INTO public.weeks (partnership_id, template_id, start_date, end_date, status)
  VALUES (p_partnership_id, p_template_id, p_start_date, p_end_date, 'active')
  RETURNING * INTO v_week;

  -- 4 & 5. Copy each task and initialise progress for both users
  FOR v_task_def IN
    SELECT jsonb_array_elements(t.task_definitions)
      FROM public.weekly_templates t
     WHERE t.id = p_template_id
  LOOP
    INSERT INTO public.weekly_tasks (
      week_id,
      title,
      task_type,
      target_value,
      sort_order
    ) VALUES (
      v_week.id,
      v_task_def->>'title',
      v_task_def->>'task_type',
      CASE
        WHEN (v_task_def->>'target_value') IS NOT NULL
        THEN (v_task_def->>'target_value')::integer
        ELSE NULL
      END,
      COALESCE((v_task_def->>'sort_order')::integer, 0)
    )
    RETURNING * INTO v_task;

    -- Progress row for user_a
    INSERT INTO public.task_progress (task_id, user_id, current_value)
    VALUES (v_task.id, v_user_a_id, 0);

    -- Progress row for user_b
    INSERT INTO public.task_progress (task_id, user_id, current_value)
    VALUES (v_task.id, v_user_b_id, 0);
  END LOOP;

  RETURN v_week;
END;
$$;

-- Only authenticated users can call this; the body re-checks membership
GRANT EXECUTE ON FUNCTION public.create_week_for_partnership(UUID, UUID, DATE, DATE)
  TO authenticated;

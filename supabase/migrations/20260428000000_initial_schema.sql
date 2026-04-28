-- ============================================================
-- One Accord — Initial Schema
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- USERS
-- Public profile that mirrors auth.users.
-- Created automatically via trigger on signup.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.users (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- PARTNERSHIPS
-- Links two users as accountability partners.
-- Flow: User A creates a pending partnership with an invite_code.
--       User B enters the code → user_b_id is set, status → active.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.partnerships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b_id    UUID        REFERENCES public.users(id) ON DELETE CASCADE,
  invite_code  TEXT        NOT NULL UNIQUE
                           DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'active', 'dissolved')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,

  CONSTRAINT partnerships_no_self_pair
    CHECK (user_b_id IS NULL OR user_a_id != user_b_id)
);

-- Prevent two users from having more than one active partnership together.
-- Canonicalise pair so (A,B) and (B,A) map to the same index entry.
CREATE UNIQUE INDEX partnerships_unique_active_pair
  ON public.partnerships (
    LEAST   (user_a_id::text, user_b_id::text),
    GREATEST(user_a_id::text, user_b_id::text)
  )
  WHERE status = 'active' AND user_b_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- WEEKLY TEMPLATES
-- Defines the recurring task structure for a partnership.
-- Exactly one active template per partnership at any time.
-- Settings changes create a NEW template; current week is unaffected.
--
-- task_definitions JSONB shape (array of objects):
--   {
--     "id":           "<uuid string>",   -- stable reference id
--     "title":        "Bible reading",
--     "task_type":    "counter" | "simple",
--     "target_value": 7,                 -- required for counter, omitted for simple
--     "sort_order":   0
--   }
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.weekly_templates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id   UUID        NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  week_start_day   SMALLINT    NOT NULL DEFAULT 0
                               CHECK (week_start_day BETWEEN 0 AND 6),
  task_definitions JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active template per partnership
CREATE UNIQUE INDEX weekly_templates_one_active
  ON public.weekly_templates (partnership_id)
  WHERE is_active = true;


-- ─────────────────────────────────────────────────────────────
-- WEEKS
-- One active week per partnership.
-- On week rollover: current week → 'completed' (immutable),
-- new week is created from the active template.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.weeks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID        NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  template_id    UUID        NOT NULL REFERENCES public.weekly_templates(id),
  start_date     DATE        NOT NULL,
  end_date       DATE        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'completed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT weeks_valid_date_range CHECK (end_date > start_date)
);

-- Only one active week per partnership at a time
CREATE UNIQUE INDEX weeks_one_active_per_partnership
  ON public.weeks (partnership_id)
  WHERE status = 'active';


-- ─────────────────────────────────────────────────────────────
-- WEEKLY TASKS
-- Task instances copied from template when a week is created.
-- Immutable once the week is completed.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.weekly_tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id      UUID        NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL CHECK (length(trim(title)) > 0),
  task_type    TEXT        NOT NULL CHECK (task_type IN ('counter', 'simple')),
  target_value INTEGER     CHECK (target_value IS NULL OR target_value > 0),
  sort_order   SMALLINT    NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Counter tasks must have a target; simple tasks must not
  CONSTRAINT weekly_tasks_counter_requires_target
    CHECK (
      (task_type = 'counter' AND target_value IS NOT NULL) OR
      (task_type = 'simple'  AND target_value IS NULL)
    )
);


-- ─────────────────────────────────────────────────────────────
-- TASK PROGRESS
-- One row per (user, task). Updated in-place as the user makes
-- progress. Progress resets each week (new rows per new week).
--
-- current_value semantics:
--   counter task → 0..target_value  (no over-completion enforced by trigger)
--   simple task  → 0 (incomplete) | 1 (complete)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.task_progress (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID        NOT NULL REFERENCES public.weekly_tasks(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.users(id)         ON DELETE CASCADE,
  current_value INTEGER     NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (task_id, user_id),
  CONSTRAINT task_progress_non_negative CHECK (current_value >= 0)
);

-- Enforce business rules: no over-completion, simple task is 0|1 only
CREATE OR REPLACE FUNCTION public.check_task_progress_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_type    TEXT;
  v_target_value INTEGER;
BEGIN
  SELECT task_type, target_value
    INTO v_task_type, v_target_value
    FROM public.weekly_tasks
   WHERE id = NEW.task_id;

  IF v_task_type = 'counter' THEN
    IF NEW.current_value > v_target_value THEN
      RAISE EXCEPTION
        'Counter value (%) cannot exceed target (%)', NEW.current_value, v_target_value;
    END IF;
  ELSIF v_task_type = 'simple' THEN
    IF NEW.current_value NOT IN (0, 1) THEN
      RAISE EXCEPTION 'Simple task value must be 0 or 1, got %', NEW.current_value;
    END IF;
  END IF;

  -- Auto-set completed_at when task becomes complete
  IF v_task_type = 'counter' AND NEW.current_value = v_target_value AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  IF v_task_type = 'simple' AND NEW.current_value = 1 AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  -- Clear completed_at if value is reduced back below target
  IF (v_task_type = 'counter' AND NEW.current_value < v_target_value) OR
     (v_task_type = 'simple'  AND NEW.current_value = 0) THEN
    NEW.completed_at = NULL;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_task_progress_limits
  BEFORE INSERT OR UPDATE ON public.task_progress
  FOR EACH ROW EXECUTE FUNCTION public.check_task_progress_limits();


-- ─────────────────────────────────────────────────────────────
-- REFLECTIONS
-- Free-text entries tied to a week, optionally to a specific task.
-- Immutable once week is completed (enforced by RLS policy).
-- Private to the user in V1.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.reflections (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id    UUID        NOT NULL REFERENCES public.weeks(id)         ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id)         ON DELETE CASCADE,
  task_id    UUID        REFERENCES public.weekly_tasks(id)           ON DELETE SET NULL,
  content    TEXT        NOT NULL CHECK (length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────────────────────
-- SHARED UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER weekly_templates_updated_at
  BEFORE UPDATE ON public.weekly_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX idx_partnerships_user_a     ON public.partnerships  (user_a_id);
CREATE INDEX idx_partnerships_user_b     ON public.partnerships  (user_b_id);
CREATE INDEX idx_partnerships_invite     ON public.partnerships  (invite_code);
CREATE INDEX idx_templates_partnership   ON public.weekly_templates (partnership_id);
CREATE INDEX idx_weeks_partnership       ON public.weeks         (partnership_id);
CREATE INDEX idx_weeks_template          ON public.weeks         (template_id);
CREATE INDEX idx_weeks_status            ON public.weeks         (partnership_id, status);
CREATE INDEX idx_weekly_tasks_week       ON public.weekly_tasks  (week_id, sort_order);
CREATE INDEX idx_task_progress_task      ON public.task_progress (task_id);
CREATE INDEX idx_task_progress_user      ON public.task_progress (user_id);
CREATE INDEX idx_task_progress_task_user ON public.task_progress (task_id, user_id);
CREATE INDEX idx_reflections_week        ON public.reflections   (week_id);
CREATE INDEX idx_reflections_user        ON public.reflections   (user_id);
CREATE INDEX idx_reflections_task        ON public.reflections   (task_id);


-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnerships     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_progress    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflections      ENABLE ROW LEVEL SECURITY;


-- ── users ────────────────────────────────────────────────────

-- Own profile
CREATE POLICY "users: read own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users: update own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Read partner's profile (needed for Companion view)
CREATE POLICY "users: read partner"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.status = 'active'
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
        AND (p.user_a_id = users.id   OR p.user_b_id = users.id)
    )
  );


-- ── partnerships ─────────────────────────────────────────────

CREATE POLICY "partnerships: read as member"
  ON public.partnerships FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "partnerships: insert as initiator"
  ON public.partnerships FOR INSERT
  WITH CHECK (auth.uid() = user_a_id);

-- Allow user_b to claim the invite (set user_b_id) or either to dissolve
CREATE POLICY "partnerships: update as member"
  ON public.partnerships FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);


-- ── weekly_templates ─────────────────────────────────────────

CREATE POLICY "weekly_templates: read as member"
  ON public.weekly_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = weekly_templates.partnership_id
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
    )
  );

CREATE POLICY "weekly_templates: insert as member"
  ON public.weekly_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = partnership_id
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
        AND p.status = 'active'
    )
  );

CREATE POLICY "weekly_templates: update as member"
  ON public.weekly_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = weekly_templates.partnership_id
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
    )
  );


-- ── weeks ────────────────────────────────────────────────────

CREATE POLICY "weeks: read as member"
  ON public.weeks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = weeks.partnership_id
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
    )
  );

CREATE POLICY "weeks: insert as member"
  ON public.weeks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = partnership_id
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
        AND p.status = 'active'
    )
  );

CREATE POLICY "weeks: update as member"
  ON public.weeks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships p
      WHERE p.id = weeks.partnership_id
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
    )
  );


-- ── weekly_tasks ─────────────────────────────────────────────

CREATE POLICY "weekly_tasks: read as member"
  ON public.weekly_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.weeks w
      JOIN public.partnerships p ON p.id = w.partnership_id
      WHERE w.id = weekly_tasks.week_id
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
    )
  );

CREATE POLICY "weekly_tasks: insert as member"
  ON public.weekly_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.weeks w
      JOIN public.partnerships p ON p.id = w.partnership_id
      WHERE w.id = week_id
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
        AND w.status = 'active'
    )
  );


-- ── task_progress ────────────────────────────────────────────

-- Both users can read each other's progress (core feature)
CREATE POLICY "task_progress: read as member"
  ON public.task_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_tasks wt
      JOIN public.weeks w       ON w.id  = wt.week_id
      JOIN public.partnerships p ON p.id = w.partnership_id
      WHERE wt.id = task_progress.task_id
        AND (p.user_a_id = auth.uid() OR p.user_b_id = auth.uid())
    )
  );

-- Only own progress can be written
CREATE POLICY "task_progress: insert own"
  ON public.task_progress FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.weekly_tasks wt
      JOIN public.weeks w ON w.id = wt.week_id
      WHERE wt.id = task_id AND w.status = 'active'
    )
  );

CREATE POLICY "task_progress: update own on active week"
  ON public.task_progress FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.weekly_tasks wt
      JOIN public.weeks w ON w.id = wt.week_id
      WHERE wt.id = task_progress.task_id AND w.status = 'active'
    )
  );


-- ── reflections ──────────────────────────────────────────────
-- V1: private to the author; locked once week is completed

CREATE POLICY "reflections: read own"
  ON public.reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "reflections: insert own on active week"
  ON public.reflections FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.weeks w
      WHERE w.id = week_id AND w.status = 'active'
    )
  );

CREATE POLICY "reflections: update own on active week"
  ON public.reflections FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.weeks w
      WHERE w.id = reflections.week_id AND w.status = 'active'
    )
  );

CREATE POLICY "reflections: delete own on active week"
  ON public.reflections FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.weeks w
      WHERE w.id = reflections.week_id AND w.status = 'active'
    )
  );

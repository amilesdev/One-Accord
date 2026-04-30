-- ============================================================
-- One Accord — Enhance Reflections (idempotent)
-- ============================================================
-- Changes:
--   1. Add updated_at column to reflections
--   2. Wire up shared set_updated_at trigger
--   3. Enforce one reflection per (user, task, week):
--        - task-scoped:  UNIQUE (user_id, week_id, task_id) WHERE task_id IS NOT NULL
--        - week-level:   UNIQUE (user_id, week_id)          WHERE task_id IS NULL
--   4. Add composite lookup index
-- ============================================================

DO $$
BEGIN

  -- ── 1. Add updated_at ──────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'reflections'
      AND column_name  = 'updated_at'
  ) THEN
    ALTER TABLE public.reflections
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    UPDATE public.reflections SET updated_at = created_at;
  END IF;

  -- ── 2. Trigger ─────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname   = 'reflections_updated_at'
      AND tgrelid  = 'public.reflections'::regclass
  ) THEN
    CREATE TRIGGER reflections_updated_at
      BEFORE UPDATE ON public.reflections
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ── 3. Unique index: task-scoped ───────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'reflections'
      AND indexname  = 'reflections_unique_per_task'
  ) THEN
    CREATE UNIQUE INDEX reflections_unique_per_task
      ON public.reflections (user_id, week_id, task_id)
      WHERE task_id IS NOT NULL;
  END IF;

  -- ── 3. Unique index: week-level ────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'reflections'
      AND indexname  = 'reflections_unique_week_level'
  ) THEN
    CREATE UNIQUE INDEX reflections_unique_week_level
      ON public.reflections (user_id, week_id)
      WHERE task_id IS NULL;
  END IF;

  -- ── 4. Composite lookup index ──────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'reflections'
      AND indexname  = 'idx_reflections_user_week'
  ) THEN
    CREATE INDEX idx_reflections_user_week
      ON public.reflections (user_id, week_id);
  END IF;

END;
$$;

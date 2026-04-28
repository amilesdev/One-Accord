import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  DbPartnership,
  DbWeek,
  DbTaskProgress,
  DbWeeklyTemplate,
  TaskWithProgress,
  WeekWithTasks,
} from "@/lib/types/database";

// ─── Partnerships ─────────────────────────────────────────────────────────────

/**
 * Returns the caller's active partnership, or null if they don't have one.
 * Wrapped with React.cache() so multiple callers in the same server request
 * (e.g. layout + page) share a single DB round-trip.
 */
export const getActivePartnership = cache(async (
  userId: string
): Promise<DbPartnership | null> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("partnerships")
    .select("*")
    .eq("status", "active")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .maybeSingle();

  return data ?? null;
});

/**
 * Returns the partner's user_id relative to the calling user.
 */
export function getPartnerId(
  partnership: DbPartnership,
  myUserId: string
): string {
  return partnership.user_a_id === myUserId
    ? partnership.user_b_id!
    : partnership.user_a_id;
}

// ─── Templates ────────────────────────────────────────────────────────────────

/**
 * Returns the active template for a partnership, or null.
 */
export async function getActiveTemplate(
  partnershipId: string
): Promise<DbWeeklyTemplate | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("weekly_templates")
    .select("*")
    .eq("partnership_id", partnershipId)
    .eq("is_active", true)
    .maybeSingle();

  return data ?? null;
}

// ─── Weeks ────────────────────────────────────────────────────────────────────

/**
 * Returns the active week for a partnership, or null.
 * Cached per request — layout and page share one DB round-trip.
 */
export const getActiveWeek = cache(async (
  partnershipId: string
): Promise<DbWeek | null> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("weeks")
    .select("*")
    .eq("partnership_id", partnershipId)
    .eq("status", "active")
    .maybeSingle();

  return data ?? null;
});

/**
 * Returns completed weeks for a partnership, newest first.
 */
export async function getWeekHistory(
  partnershipId: string
): Promise<DbWeek[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("weeks")
    .select("*")
    .eq("partnership_id", partnershipId)
    .eq("status", "completed")
    .order("start_date", { ascending: false });

  return data ?? [];
}

// ─── Tasks + Progress ─────────────────────────────────────────────────────────

/**
 * Returns all tasks for a week with a specific user's progress merged in.
 * Two parallel queries, O(n) merge — no subqueries needed.
 */
export async function getTasksWithProgress(
  weekId: string,
  userId: string
): Promise<TaskWithProgress[]> {
  const supabase = await createClient();

  const [{ data: tasks }, { data: allProgress }] = await Promise.all([
    supabase
      .from("weekly_tasks")
      .select("*")
      .eq("week_id", weekId)
      .order("sort_order"),
    supabase
      .from("task_progress")
      .select("*")
      .eq("user_id", userId),
  ]);

  const taskIdSet = new Set((tasks ?? []).map((t) => t.id));
  const progressMap = new Map<string, DbTaskProgress>(
    (allProgress ?? [])
      .filter((p) => taskIdSet.has(p.task_id))
      .map((p) => [p.task_id, p])
  );

  return (tasks ?? []).map((task) => ({
    ...task,
    progress: progressMap.get(task.id) ?? null,
  }));
}

/**
 * Returns the active week with tasks and a specific user's progress merged in.
 * Returns null if there is no active week.
 */
export async function getActiveWeekWithProgress(
  partnershipId: string,
  userId: string
): Promise<WeekWithTasks | null> {
  const week = await getActiveWeek(partnershipId);
  if (!week) return null;

  const tasks = await getTasksWithProgress(week.id, userId);
  return { ...week, tasks };
}

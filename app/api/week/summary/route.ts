import { createClient } from "@/lib/supabase/server";
import { requireAuth, requirePartnership } from "@/lib/api/helpers";
import { getWeekHistory, getPartnerId } from "@/lib/week/queries";
import { formatWeekRange, calcCompletionPercent } from "@/lib/week/utils";

/**
 * GET /api/week/summary
 *
 * Returns all completed weeks with per-week completion percentages
 * for both the authenticated user and their partner.
 *
 * Uses 3 queries total regardless of the number of completed weeks:
 *   1. Completed weeks list
 *   2. All tasks for those weeks
 *   3. All task_progress for both users across those weeks
 *
 * Response:
 *   { data: { weeks: WeekSummary[] } }
 */
export async function GET() {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { partnership, partnershipError } = await requirePartnership(user!.id);
  if (partnershipError) return partnershipError;

  const weeks = await getWeekHistory(partnership!.id);
  if (weeks.length === 0) {
    return Response.json({ data: { weeks: [] }, error: null });
  }

  const partnerId = getPartnerId(partnership!, user!.id);
  const weekIds   = weeks.map((w) => w.id);
  const supabase  = await createClient();

  // Query 1: all tasks for completed weeks
  const { data: allTasks } = await supabase
    .from("weekly_tasks")
    .select("id, week_id, task_type, target_value")
    .in("week_id", weekIds);

  // Query 2: all progress for those tasks (both users), scoped by task IDs
  const taskIds = (allTasks ?? []).map((t) => t.id);
  const { data: progress } = taskIds.length
    ? await supabase
        .from("task_progress")
        .select("task_id, user_id, current_value")
        .in("task_id", taskIds)
    : { data: [] };

  // Index by weekId and userId for O(1) lookups
  const tasksByWeek = new Map<string, typeof allTasks>();
  for (const task of allTasks ?? []) {
    const bucket = tasksByWeek.get(task.week_id) ?? [];
    bucket.push(task);
    tasksByWeek.set(task.week_id, bucket);
  }

  type ProgressRow = { task_id: string; user_id: string; current_value: number };
  const progressByUser = new Map<string, Map<string, ProgressRow>>();
  for (const row of progress ?? [] as ProgressRow[]) {
    if (!progressByUser.has(row.user_id)) progressByUser.set(row.user_id, new Map());
    progressByUser.get(row.user_id)!.set(row.task_id, row);
  }

  const summaries = weeks.map((week) => {
    const tasks = tasksByWeek.get(week.id) ?? [];

    const myPct = calcCompletionPercent(
      tasks.map((t) => ({
        task_type:     t.task_type,
        target_value:  t.target_value,
        current_value: progressByUser.get(user!.id)?.get(t.id)?.current_value ?? 0,
      }))
    );

    const partnerPct = calcCompletionPercent(
      tasks.map((t) => ({
        task_type:     t.task_type,
        target_value:  t.target_value,
        current_value: progressByUser.get(partnerId)?.get(t.id)?.current_value ?? 0,
      }))
    );

    return {
      ...week,
      week_label:         formatWeekRange(week.start_date, week.end_date),
      my_completion_pct:  myPct,
      partner_completion_pct: partnerPct,
      task_count:         tasks.length,
    };
  });

  return Response.json({ data: { weeks: summaries }, error: null });
}

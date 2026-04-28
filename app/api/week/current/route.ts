import { requireAuth, requirePartnership, err } from "@/lib/api/helpers";
import { getActiveWeekWithProgress } from "@/lib/week/queries";
import { formatWeekRange, calcCompletionPercent } from "@/lib/week/utils";

/**
 * GET /api/week/current
 *
 * Returns the active week with the authenticated user's task progress.
 *
 * Response:
 *   { data: { week, tasks, completion_pct, week_label } }
 */
export async function GET() {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { partnership, partnershipError } = await requirePartnership(user!.id);
  if (partnershipError) return partnershipError;

  const weekData = await getActiveWeekWithProgress(partnership!.id, user!.id);
  if (!weekData) return err("No active week found", 404);

  const { tasks, ...week } = weekData;

  const completion_pct = calcCompletionPercent(
    tasks.map((t) => ({
      task_type:     t.task_type,
      target_value:  t.target_value,
      current_value: t.progress?.current_value ?? 0,
    }))
  );

  return Response.json({
    data: {
      week,
      tasks,
      completion_pct,
      week_label: formatWeekRange(week.start_date, week.end_date),
    },
    error: null,
  });
}

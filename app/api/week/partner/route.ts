import { createClient } from "@/lib/supabase/server";
import { requireAuth, requirePartnership, err } from "@/lib/api/helpers";
import {
  getActiveWeek,
  getTasksWithProgress,
  getPartnerId,
} from "@/lib/week/queries";
import { formatWeekRange, calcCompletionPercent } from "@/lib/week/utils";

/**
 * GET /api/week/partner
 *
 * Returns the active week with the partner's task progress (read-only).
 *
 * Response:
 *   { data: { week, tasks, completion_pct, week_label, partner } }
 */
export async function GET() {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { partnership, partnershipError } = await requirePartnership(user!.id);
  if (partnershipError) return partnershipError;

  const partnerId = getPartnerId(partnership!, user!.id);

  // Fetch active week + partner's profile in parallel
  const supabase = await createClient();
  const [week, { data: partnerProfile }] = await Promise.all([
    getActiveWeek(partnership!.id),
    supabase
      .from("users")
      .select("id, display_name, email")
      .eq("id", partnerId)
      .maybeSingle(),
  ]);

  if (!week) return err("No active week found", 404);

  const tasks = await getTasksWithProgress(week.id, partnerId);

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
      partner: partnerProfile ?? null,
    },
    error: null,
  });
}

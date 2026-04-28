import { createClient } from "@/lib/supabase/server";
import {
  requireAuth,
  getTaskAndProgress,
  requireActiveWeek,
  err,
} from "@/lib/api/helpers";

/**
 * POST /api/tasks/[taskId]/increment
 *
 * Increments a counter task by 1. No-ops if already at target.
 *
 * Response:
 *   { data: { progress } }
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { task, progress, fetchError } = await getTaskAndProgress(taskId, user!.id);
  if (fetchError) return fetchError;

  if (task!.task_type !== "counter") {
    return err("Task is not a counter type", 400);
  }

  const target  = task!.target_value ?? 0;
  const current = progress!.current_value;

  if (current >= target) {
    return err("Task is already at maximum value", 400);
  }

  const { weekError } = await requireActiveWeek(task!.week_id);
  if (weekError) return weekError;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("task_progress")
    .update({ current_value: current + 1 })
    .eq("id", progress!.id)
    .select()
    .single();

  if (error) return err(error.message, 500);

  return Response.json({ data: { progress: updated }, error: null });
}

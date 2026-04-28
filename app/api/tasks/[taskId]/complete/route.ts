import { createClient } from "@/lib/supabase/server";
import {
  requireAuth,
  getTaskAndProgress,
  requireActiveWeek,
  err,
} from "@/lib/api/helpers";

/**
 * POST /api/tasks/[taskId]/complete
 *
 * Marks a simple task complete or incomplete.
 *
 * Body (optional):
 *   { completed: boolean }   — explicit state
 *   (omit body)              — toggle current state
 *
 * Response:
 *   { data: { progress } }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { task, progress, fetchError } = await getTaskAndProgress(taskId, user!.id);
  if (fetchError) return fetchError;

  if (task!.task_type !== "simple") {
    return err("Task is not a simple type — use /increment for counter tasks", 400);
  }

  const { weekError } = await requireActiveWeek(task!.week_id);
  if (weekError) return weekError;

  // Parse optional body
  let newValue: number;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.completed === "boolean") {
      newValue = body.completed ? 1 : 0;
    } else {
      // Toggle
      newValue = progress!.current_value === 0 ? 1 : 0;
    }
  } catch {
    newValue = progress!.current_value === 0 ? 1 : 0;
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("task_progress")
    .update({ current_value: newValue })
    .eq("id", progress!.id)
    .select()
    .single();

  if (error) return err(error.message, 500);

  return Response.json({ data: { progress: updated }, error: null });
}

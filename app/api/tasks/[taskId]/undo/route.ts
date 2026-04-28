import { createClient } from "@/lib/supabase/server";
import {
  requireAuth,
  getTaskAndProgress,
  requireActiveWeek,
  err,
} from "@/lib/api/helpers";

/**
 * POST /api/tasks/[taskId]/undo
 *
 * Restores a task's progress to a specific previous value.
 * The DB trigger still enforces all value constraints.
 *
 * Body:
 *   { value: number }   — the value to restore
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

  let body: { value?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  if (typeof body.value !== "number" || !Number.isInteger(body.value) || body.value < 0) {
    return err("value must be a non-negative integer", 400);
  }

  const { task, progress, fetchError } = await getTaskAndProgress(taskId, user!.id);
  if (fetchError) return fetchError;

  const { weekError } = await requireActiveWeek(task!.week_id);
  if (weekError) return weekError;

  // Validate bounds before hitting the DB trigger
  if (task!.task_type === "counter") {
    const target = task!.target_value ?? 0;
    if (body.value > target) {
      return err(`Value cannot exceed target (${target})`, 400);
    }
  } else {
    if (body.value !== 0 && body.value !== 1) {
      return err("Simple task value must be 0 or 1", 400);
    }
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("task_progress")
    .update({ current_value: body.value })
    .eq("id", progress!.id)
    .select()
    .single();

  if (error) return err(error.message, 500);

  return Response.json({ data: { progress: updated }, error: null });
}

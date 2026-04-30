import { createClient } from "@/lib/supabase/server";
import { requireAuth, requirePartnership, err, ok } from "@/lib/api/helpers";
import { getReflectionForTask, getReflectionsForWeek } from "@/lib/reflections/queries";

/**
 * GET /api/reflections?week_id=<uuid>
 * GET /api/reflections?week_id=<uuid>&task_id=<uuid>
 *
 * Without task_id: returns all reflections for the given week (get_reflections_for_week).
 * With task_id:    returns the single reflection for that task, or null (get_reflection_for_task).
 * Reflections are private — partner data is never included.
 */
export async function GET(req: Request) {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const week_id = searchParams.get("week_id");
  const task_id = searchParams.get("task_id");
  if (!week_id) return err("week_id query param is required", 400);

  const supabase = await createClient();

  // Verify week exists and belongs to the user's partnership
  const { partnership, partnershipError } = await requirePartnership(user!.id);
  if (partnershipError) return partnershipError;

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("id", week_id)
    .eq("partnership_id", partnership!.id)
    .maybeSingle();

  if (!week) return err("Week not found", 404);

  if (task_id) {
    const reflection = await getReflectionForTask(week_id, user!.id, task_id);
    return ok({ reflection });
  }

  const reflections = await getReflectionsForWeek(week_id, user!.id);
  return ok({ reflections });
}

/**
 * POST /api/reflections
 *
 * Upserts a reflection for a week, optionally tied to a specific task.
 * If a reflection already exists for the (user, week, task) combination
 * it is updated in place rather than creating a duplicate.
 * The week must be active.
 *
 * Body:
 *   {
 *     week_id:  string,
 *     content:  string,
 *     task_id?: string
 *   }
 */
export async function POST(req: Request) {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { partnership, partnershipError } = await requirePartnership(user!.id);
  if (partnershipError) return partnershipError;

  let body: { week_id?: string; content?: string; task_id?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { week_id, content, task_id } = body;

  if (!week_id || typeof week_id !== "string") return err("week_id is required", 400);
  if (!content  || typeof content  !== "string") return err("content is required", 400);
  if (content.trim().length === 0) return err("content cannot be blank", 400);

  const supabase = await createClient();

  // Verify week belongs to the user's partnership and is active
  const { data: week } = await supabase
    .from("weeks")
    .select("id, status, partnership_id")
    .eq("id", week_id)
    .eq("partnership_id", partnership!.id)
    .maybeSingle();

  if (!week) return err("Week not found", 404);
  if (week.status !== "active") return err("Reflections cannot be edited on a completed week", 403);

  // If task_id is provided, verify it belongs to this week
  if (task_id) {
    const { data: task } = await supabase
      .from("weekly_tasks")
      .select("id")
      .eq("id", task_id)
      .eq("week_id", week_id)
      .maybeSingle();
    if (!task) return err("Task not found in this week", 404);
  }

  // Check for an existing reflection for this (user, week, task) slot
  const existing = await getReflectionForTask(week_id, user!.id, task_id ?? null);

  if (existing) {
    const { data: reflection, error } = await supabase
      .from("reflections")
      .update({ content: content.trim() })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return err(error.message, 500);
    return ok({ reflection });
  }

  const { data: reflection, error } = await supabase
    .from("reflections")
    .insert({
      week_id,
      user_id: user!.id,
      content: content.trim(),
      task_id: task_id ?? null,
    })
    .select()
    .single();

  if (error) return err(error.message, 500);
  return ok({ reflection }, 201);
}

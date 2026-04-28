import { createClient } from "@/lib/supabase/server";
import { requireAuth, requirePartnership, err } from "@/lib/api/helpers";

/**
 * POST /api/reflections
 *
 * Creates a reflection tied to a week, and optionally to a specific task.
 * The week must be active (enforced by RLS + explicit check).
 *
 * Body:
 *   {
 *     week_id:  string,
 *     content:  string,
 *     task_id?: string   // optional — ties reflection to a task
 *   }
 *
 * Response:
 *   { data: { reflection } }
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

  // Verify the week belongs to the user's partnership and is active
  const { data: week } = await supabase
    .from("weeks")
    .select("id, status, partnership_id")
    .eq("id", week_id)
    .eq("partnership_id", partnership!.id)
    .maybeSingle();

  if (!week)              return err("Week not found", 404);
  if (week.status !== "active") return err("Reflections cannot be added to a completed week", 403);

  // If task_id provided, verify it belongs to this week
  if (task_id) {
    const { data: task } = await supabase
      .from("weekly_tasks")
      .select("id")
      .eq("id", task_id)
      .eq("week_id", week_id)
      .maybeSingle();
    if (!task) return err("Task not found in this week", 404);
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

  return Response.json({ data: { reflection }, error: null }, { status: 201 });
}

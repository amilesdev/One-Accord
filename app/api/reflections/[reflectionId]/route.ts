import { createClient } from "@/lib/supabase/server";
import { requireAuth, err, ok } from "@/lib/api/helpers";
import { getReflectionById } from "@/lib/reflections/queries";

/**
 * PATCH /api/reflections/[reflectionId]
 *
 * Updates the content of an existing reflection.
 * Only the owner may edit, and only while the week is active.
 *
 * Body:
 *   { content: string }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ reflectionId: string }> }
) {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { reflectionId } = await params;

  const reflection = await getReflectionById(reflectionId, user!.id);
  if (!reflection) return err("Reflection not found", 404);

  // Enforce active-week lock
  const supabase = await createClient();
  const { data: week } = await supabase
    .from("weeks")
    .select("status")
    .eq("id", reflection.week_id)
    .maybeSingle();

  if (!week || week.status !== "active") {
    return err("Reflections cannot be edited on a completed week", 403);
  }

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { content } = body;
  if (!content || typeof content !== "string") return err("content is required", 400);
  if (content.trim().length === 0) return err("content cannot be blank", 400);

  const { data: updated, error } = await supabase
    .from("reflections")
    .update({ content: content.trim() })
    .eq("id", reflectionId)
    .select()
    .single();

  if (error) return err(error.message, 500);
  return ok({ reflection: updated });
}

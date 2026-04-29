import { createClient } from "@/lib/supabase/server";
import { requireAuth, requirePartnership, err } from "@/lib/api/helpers";
import { getActiveTemplate } from "@/lib/week/queries";
import type { TemplateTaskDefinition } from "@/lib/types/database";

/**
 * GET /api/template
 *
 * Returns the active weekly template for the user's partnership.
 *
 * Response:
 *   { data: { template } }
 */
export async function GET() {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { partnership, partnershipError } = await requirePartnership(user!.id);
  if (partnershipError) return partnershipError;

  const template = await getActiveTemplate(partnership!.id);
  if (!template) return err("No active template found", 404);

  return Response.json({ data: { template }, error: null });
}

/**
 * PUT /api/template
 *
 * Replaces the weekly template. Deactivates the current template and
 * creates a new one. Changes apply to the NEXT week, not the current one.
 *
 * Body:
 *   {
 *     week_start_day:   number,           // 0–6 (Sun–Sat)
 *     task_definitions: TemplateTaskDefinition[]
 *   }
 *
 * Response:
 *   { data: { template } }
 */
export async function PUT(request: Request) {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { partnership, partnershipError } = await requirePartnership(user!.id);
  if (partnershipError) return partnershipError;

  let body: { week_start_day?: number; task_definitions?: TemplateTaskDefinition[] };
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { week_start_day, task_definitions } = body;

  if (typeof week_start_day !== "number" || week_start_day < 0 || week_start_day > 6) {
    return err("week_start_day must be an integer 0–6", 400);
  }
  if (!Array.isArray(task_definitions)) {
    return err("task_definitions must be an array", 400);
  }

  // Validate each task definition
  for (const def of task_definitions) {
    if (!def.title || typeof def.title !== "string") {
      return err("Each task must have a non-empty title", 400);
    }
    if (def.task_type !== "counter" && def.task_type !== "simple") {
      return err("task_type must be 'counter' or 'simple'", 400);
    }
    if (def.task_type === "counter") {
      if (!def.target_value || def.target_value < 1) {
        return err("Counter tasks require a target_value >= 1", 400);
      }
    }
  }

  const supabase = await createClient();

  // Deactivate FIRST, then insert — must be sequential to avoid violating
  // the unique index on (partnership_id) WHERE is_active = true.
  const { error: deactivateError } = await supabase
    .from("weekly_templates")
    .update({ is_active: false })
    .eq("partnership_id", partnership!.id)
    .eq("is_active", true);

  if (deactivateError) return err(deactivateError.message, 500);

  const { data: newTemplate, error } = await supabase
    .from("weekly_templates")
    .insert({
      partnership_id:   partnership!.id,
      week_start_day,
      task_definitions,
      is_active:        true,
    })
    .select()
    .single();

  if (error) return err(error.message, 500);

  return Response.json({ data: { template: newTemplate }, error: null }, { status: 201 });
}

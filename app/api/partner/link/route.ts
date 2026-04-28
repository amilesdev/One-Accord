import { createClient } from "@/lib/supabase/server";
import { requireAuth, err } from "@/lib/api/helpers";
import { getActivePartnership } from "@/lib/week/queries";

/**
 * POST /api/partner/link
 *
 * Claims a pending partnership using an invite code, activating the link
 * between two users.
 *
 * Body:
 *   { invite_code: string }
 *
 * Guards:
 *   - Caller cannot claim their own invite code
 *   - Caller cannot link if they already have an active partnership
 *   - Invite code must belong to a pending partnership
 *
 * Response:
 *   { data: { partnership } }
 */
export async function POST(req: Request) {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  let body: { invite_code?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { invite_code } = body;

  if (!invite_code || typeof invite_code !== "string" || invite_code.trim().length === 0) {
    return err("invite_code is required", 400);
  }

  // Block if already in an active partnership
  const existing = await getActivePartnership(user!.id);
  if (existing) return err("You are already in an active partnership", 409);

  const supabase = await createClient();

  const { data: partnership } = await supabase
    .from("partnerships")
    .select("*")
    .eq("invite_code", invite_code.trim().toUpperCase())
    .eq("status", "pending")
    .maybeSingle();

  if (!partnership) return err("Invite code not found or already used", 404);

  // Cannot claim your own invite
  if (partnership.user_a_id === user!.id) {
    return err("You cannot link with yourself", 400);
  }

  const { data: activated, error } = await supabase
    .from("partnerships")
    .update({
      user_b_id:    user!.id,
      status:       "active",
      activated_at: new Date().toISOString(),
    })
    .eq("id", partnership.id)
    .select()
    .single();

  if (error) return err(error.message, 500);

  return Response.json({ data: { partnership: activated }, error: null });
}

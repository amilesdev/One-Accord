import { createClient } from "@/lib/supabase/server";
import { requireAuth, err } from "@/lib/api/helpers";
import { getActivePartnership } from "@/lib/week/queries";

/**
 * POST /api/partner/invite
 *
 * Creates a new pending partnership for the authenticated user and returns
 * an invite code to share with their partner.
 * Fails if the user already has an active partnership.
 *
 * Response:
 *   { data: { partnership } }
 */
export async function POST() {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  // Block if already in an active partnership
  const existing = await getActivePartnership(user!.id);
  if (existing) return err("You are already in an active partnership", 409);

  const supabase = await createClient();

  // Also block if there is already a pending invite from this user
  const { data: pending } = await supabase
    .from("partnerships")
    .select("id, invite_code")
    .eq("user_a_id", user!.id)
    .eq("status", "pending")
    .maybeSingle();

  if (pending) {
    return Response.json({ data: { partnership: pending }, error: null });
  }

  const { data: partnership, error } = await supabase
    .from("partnerships")
    .insert({ user_a_id: user!.id, status: "pending" })
    .select()
    .single();

  if (error) return err(error.message, 500);

  return Response.json({ data: { partnership }, error: null }, { status: 201 });
}

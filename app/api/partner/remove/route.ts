import { createClient } from "@/lib/supabase/server";
import { requireAuth, err } from "@/lib/api/helpers";

/**
 * POST /api/partner/remove
 *
 * Dissolves the caller's active partnership by setting status → "dissolved".
 * Both users lose access to the shared weekly data going forward.
 */
export async function POST() {
  const { user, unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
 if (!user) {
    return err("unauthorized", 401);
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from("partnerships")
    .update({ status: "dissolved" })
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq("status", "active");

  if (error) return err(error.message, 500);

  return Response.json({ data: null, error: null });
}

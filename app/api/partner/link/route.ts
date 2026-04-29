import { createClient } from "@/lib/supabase/server";
import { requireAuth, err } from "@/lib/api/helpers";

/**
 * POST /api/partner/link
 *
 * Claims a pending partnership using an invite code.
 * Delegates all logic (existence check, self-link guard, already-partnered
 * guard, race-condition lock) to the SECURITY DEFINER SQL function
 * `claim_partnership_invite`, which bypasses RLS so it can both read and
 * update a pending row the caller isn't a member of yet.
 *
 * Body:     { invite_code: string }
 * Response: { data: { partnership } }
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

  const supabase = await createClient();

  const { data: partnership, error } = await supabase.rpc(
    "claim_partnership_invite",
    { p_invite_code: invite_code.trim() }
  );

  if (error) {
    if (error.message.includes("already_partnered"))
      return err("You are already in an active partnership", 409);
    if (error.message.includes("self_link"))
      return err("You cannot link with yourself", 400);
    if (error.message.includes("not_found"))
      return err("Invite code not found or already used", 404);
    return err(error.message, 500);
  }

  return Response.json({ data: { partnership }, error: null });
}

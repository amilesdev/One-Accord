import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsClient } from "@/components/settings/settings-client";
import {
  getActivePartnership,
  getActiveTemplate,
  getPartnerId,
} from "@/lib/week/queries";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Active partnership (status = "active" only)
  const partnership = await getActivePartnership(user.id);

  // Pending invite the user created (getActivePartnership excludes these)
  const { data: pendingPartnership } = await supabase
    .from("partnerships")
    .select("invite_code")
    .eq("user_a_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  // User's own profile + most recent invite code they created
  const [profileResult, inviteCodeResult] = await Promise.all([
    supabase
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("partnerships")
      .select("invite_code")
      .eq("user_a_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Template + partner profile — only needed when there's an active partnership
  let template     = null;
  let partnerProfile = null;

  if (partnership) {
    const partnerId = getPartnerId(partnership, user.id);

    [template, partnerProfile] = await Promise.all([
      getActiveTemplate(partnership.id),
      supabase
        .from("users")
        .select("id, display_name, email")
        .eq("id", partnerId)
        .maybeSingle()
        .then((r) => r.data),
    ]);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your weekly plan and partner."
      />
      <SettingsClient
        userId={user.id}
        userDisplayName={profileResult.data?.display_name ?? null}
        userEmail={user.email ?? ""}
        userInviteCode={inviteCodeResult.data?.invite_code ?? null}
        initialTemplate={template}
        partnership={partnership}
        pendingInviteCode={pendingPartnership?.invite_code ?? null}
        partnerProfile={
          partnerProfile as { display_name: string | null; email: string } | null
        }
      />
    </div>
  );
}

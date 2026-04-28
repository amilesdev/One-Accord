import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <PageHeader
        title="Settings"
        subtitle="Manage your weekly plan and preferences."
      />

      {/* Settings sections placeholders */}
      <div className="space-y-3">
        {["Weekly plan", "Partner", "Account"].map((section) => (
          <div
            key={section}
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4"
          >
            <span className="text-sm font-medium text-foreground">{section}</span>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}

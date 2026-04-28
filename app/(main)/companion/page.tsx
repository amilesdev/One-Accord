import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";

export default async function CompanionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <PageHeader
        title="Companion"
        subtitle="Your partner's progress this week."
      />

      {/* Partner card placeholder */}
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">No partner linked</p>
        <p className="text-xs text-muted-foreground">
          Connect with a partner in Settings to see their progress here.
        </p>
      </div>
    </div>
  );
}

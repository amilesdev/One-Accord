import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";

export default async function SummaryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <PageHeader
        title="Summary"
        subtitle="Past weeks and reflections."
      />

      {/* Empty history placeholder */}
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">No history yet</p>
        <p className="text-xs text-muted-foreground">
          Completed weeks will appear here as read-only summaries.
        </p>
      </div>
    </div>
  );
}

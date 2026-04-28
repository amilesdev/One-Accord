import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <PageHeader
        title="This Week"
        subtitle="Your personal tasks and progress."
      />

      {/* Progress overview placeholder */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Weekly progress</span>
          <span className="text-sm text-muted-foreground">—</span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div className="h-full w-0 rounded-full bg-primary transition-all duration-500" />
        </div>
      </div>

      {/* Tasks placeholder */}
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">No tasks yet</p>
        <p className="text-xs text-muted-foreground">
          Set up your weekly plan in Settings to get started.
        </p>
      </div>
    </div>
  );
}

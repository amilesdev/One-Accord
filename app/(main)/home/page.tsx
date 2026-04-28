import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { TaskList } from "@/components/tasks/task-list";
import {
  getActivePartnership,
  getActiveWeekWithProgress,
} from "@/lib/week/queries";
import { formatWeekRange } from "@/lib/week/utils";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const partnership = await getActivePartnership(user.id);

  // ── No partnership yet ────────────────────────────────────────────────────
  if (!partnership) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <PageHeader title="This Week" />
        <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">No partner linked</p>
          <p className="text-xs text-muted-foreground">
            Go to Settings to connect with your accountability partner.
          </p>
        </div>
      </div>
    );
  }

  const weekData = await getActiveWeekWithProgress(partnership.id, user.id);

  // ── No active week (no template set up yet) ───────────────────────────────
  if (!weekData) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <PageHeader title="This Week" />
        <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">No weekly plan yet</p>
          <p className="text-xs text-muted-foreground">
            Set up your weekly plan in Settings to get started.
          </p>
        </div>
      </div>
    );
  }

  const weekLabel = formatWeekRange(weekData.start_date, weekData.end_date);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <PageHeader
        title="This Week"
        subtitle="Your personal tasks and progress."
      />
      <TaskList tasks={weekData.tasks} weekLabel={weekLabel} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { Users, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { WeekSummaryModal } from "@/components/summary/week-summary-modal";
import {
  getActivePartnership,
  getActiveWeekWithProgress,
} from "@/lib/week/queries";
import { formatWeekRange } from "@/lib/week/utils";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const partnership = await getActivePartnership(user.id);

  // ── No partnership ────────────────────────────────────────────────────────
  if (!partnership) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <PageHeader title="This Week" />
        <EmptyCard
          icon={<Users className="h-5 w-5" />}
          title="No partner linked"
          body="Go to Settings to connect with your accountability partner."
        />
      </div>
    );
  }

  const weekData = await getActiveWeekWithProgress(partnership.id, user.id);

  // ── No active week / template ─────────────────────────────────────────────
  if (!weekData) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <PageHeader title="This Week" />
        <EmptyCard
          icon={<CalendarDays className="h-5 w-5" />}
          title="No weekly plan yet"
          body="Set up your weekly plan in Settings to get started."
        />
      </div>
    );
  }

  const weekLabel = formatWeekRange(weekData.start_date, weekData.end_date);

  // ── Active week ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      <PageHeader title="This Week" subtitle={weekLabel} />
      <TaskList tasks={weekData.tasks} weekLabel={weekLabel} />
      <WeekSummaryModal currentWeekId={weekData.id} />
    </div>
  );
}

// ─── Empty state card ─────────────────────────────────────────────────────────

function EmptyCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

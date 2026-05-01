import { redirect } from "next/navigation";
import { Users, CalendarDays, AlertCircle } from "lucide-react";
import { ShalomInfo } from "@/components/home/shalom-info";
import { createClient } from "@/lib/supabase/server";
import { TaskList } from "@/components/tasks/task-list";
import { WeekSummaryModal } from "@/components/summary/week-summary-modal";
import { AutoRefresh } from "@/components/realtime/auto-refresh";
import {
  getActivePartnership,
  getActiveWeekWithProgress,
} from "@/lib/week/queries";
import { getReflectionsForWeek } from "@/lib/reflections/queries";
import { ensureActiveWeek } from "@/lib/week/actions";
import { formatWeekRange } from "@/lib/week/utils";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch display name and partnership in parallel
  const [{ data: userProfile }, partnership] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", user.id).maybeSingle(),
    getActivePartnership(user.id),
  ]);

  const displayName =
    userProfile?.display_name?.trim().split(" ")[0] ??
    user.email?.split("@")[0] ??
    "Friend";

  // ── No partnership ────────────────────────────────────────────────────────
  if (!partnership) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <Greeting name={displayName} />
        <EmptyCard
          icon={<Users className="h-5 w-5" />}
          title="No partner linked"
          body="Go to Settings to connect with your accountability partner."
        />
      </div>
    );
  }

  // Create the week from the template if one doesn't exist yet.
  // Must run in the page (not the layout) because layouts don't re-render
  // on client-side navigation between child routes.
  const weekResult = await ensureActiveWeek();

  // Skip the DB round-trip when we already know there is no active week.
  const weekData =
    weekResult.status === "ok"
      ? await getActiveWeekWithProgress(partnership.id, user.id)
      : null;

  // ── No active week / template ─────────────────────────────────────────────
  if (!weekData) {
    if (weekResult.status === "error") {
      return (
        <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
          <Greeting name={displayName} />
          <EmptyCard
            icon={<AlertCircle className="h-5 w-5" />}
            title="Something went wrong"
            body={weekResult.message}
          />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <Greeting name={displayName} />
        <EmptyCard
          icon={<CalendarDays className="h-5 w-5" />}
          title="No weekly plan yet"
          body="Set up your weekly plan in Settings to get started."
        />
      </div>
    );
  }

  const weekLabel  = formatWeekRange(weekData.start_date, weekData.end_date);
  const reflections = await getReflectionsForWeek(weekData.id, user.id);
  const reflectionTaskIds = reflections
    .filter((r) => r.task_id !== null)
    .map((r) => r.task_id as string);

  // ── Active week ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      <Greeting name={displayName} subtitle={weekLabel} />
      <TaskList
        tasks={weekData.tasks}
        weekId={weekData.id}
        weekStatus={weekData.status}
        initialReflectionTaskIds={reflectionTaskIds}
      />
      <WeekSummaryModal currentWeekId={weekData.id} />
      {/* Background reconciliation — keeps local state in sync with server */}
      <AutoRefresh intervalMs={30000} />
    </div>
  );
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

function Greeting({ name, subtitle }: { name: string; subtitle?: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-3xl font-bold tracking-tight leading-tight">
        <span className="relative inline-block">
            <span className="text-primary" style={{ fontFamily: "var(--font-great-vibes)" }}>Shalom,</span>
            <ShalomInfo />
          </span>{" "}
        <span
          className="text-foreground font-bold tracking-tight"
          style={{ textShadow: "0 0 18px rgba(255, 252, 230, 0.72), 0 0 6px rgba(255, 252, 220, 0.45)" }}
        >
          {name}
        </span>
      </h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      )}
    </header>
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
    <div className="rounded-2xl border border-border/60 bg-card shadow-card p-10 flex flex-col items-center gap-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

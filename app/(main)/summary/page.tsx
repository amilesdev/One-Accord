import { redirect } from "next/navigation";
import { CalendarDays, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import {
  getActivePartnership,
  getPartnerId,
  getWeekHistory,
} from "@/lib/week/queries";
import { formatWeekRange, calcCompletionPercent } from "@/lib/week/utils";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekEntry {
  id:          string;
  week_label:  string;
  my_pct:      number;
  partner_pct: number;
  task_count:  number;
  reflections: { id: string; content: string; created_at: string }[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SummaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const partnership = await getActivePartnership(user.id);

  // ── No partnership ──────────────────────────────────────────────────────────
  if (!partnership) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <PageHeader title="Summary" />
        <EmptyCard
          icon={<Users className="h-5 w-5" />}
          title="No partner linked"
          body="Connect with a partner in Settings to see your history here."
        />
      </div>
    );
  }

  const partnerId    = getPartnerId(partnership, user.id);
  const weeks        = await getWeekHistory(partnership.id);

  // ── No history ──────────────────────────────────────────────────────────────
  if (weeks.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <PageHeader title="Summary" subtitle="Past weeks and reflections." />
        <EmptyCard
          icon={<CalendarDays className="h-5 w-5" />}
          title="No completed weeks yet"
          body="Finished weeks will appear here as read-only summaries."
        />
      </div>
    );
  }

  const weekIds = weeks.map((w) => w.id);

  // ── Stage 2: tasks + my reflections in parallel ─────────────────────────────
  const [{ data: allTasks }, { data: myReflections }] = await Promise.all([
    supabase
      .from("weekly_tasks")
      .select("id, week_id, task_type, target_value")
      .in("week_id", weekIds),
    supabase
      .from("reflections")
      .select("id, week_id, content, created_at")
      .eq("user_id", user.id)
      .in("week_id", weekIds)
      .order("created_at"),
  ]);

  // ── Stage 3: progress for both users ────────────────────────────────────────
  const taskIds = (allTasks ?? []).map((t) => t.id);
  const { data: allProgress } = taskIds.length
    ? await supabase
        .from("task_progress")
        .select("task_id, user_id, current_value")
        .in("task_id", taskIds)
    : { data: [] };

  // ── Build lookup indexes ─────────────────────────────────────────────────────

  type TaskRow = { id: string; week_id: string; task_type: string; target_value: number | null };
  const tasksByWeek = new Map<string, TaskRow[]>();
  for (const task of (allTasks ?? []) as TaskRow[]) {
    const bucket = tasksByWeek.get(task.week_id) ?? [];
    bucket.push(task);
    tasksByWeek.set(task.week_id, bucket);
  }

  // progressByUser → userId → taskId → current_value
  type ProgRow = { task_id: string; user_id: string; current_value: number };
  const progressByUser = new Map<string, Map<string, number>>();
  for (const row of (allProgress ?? []) as ProgRow[]) {
    if (!progressByUser.has(row.user_id))
      progressByUser.set(row.user_id, new Map());
    progressByUser.get(row.user_id)!.set(row.task_id, row.current_value);
  }

  type RefRow = { id: string; week_id: string; content: string; created_at: string };
  const reflectionsByWeek = new Map<string, RefRow[]>();
  for (const ref of (myReflections ?? []) as RefRow[]) {
    const bucket = reflectionsByWeek.get(ref.week_id) ?? [];
    bucket.push(ref);
    reflectionsByWeek.set(ref.week_id, bucket);
  }

  // ── Assemble entries ─────────────────────────────────────────────────────────

  const entries: WeekEntry[] = weeks.map((week) => {
    const tasks = tasksByWeek.get(week.id) ?? [];

    const toInput = (uid: string) =>
      tasks.map((t) => ({
        task_type:     t.task_type,
        target_value:  t.target_value,
        current_value: progressByUser.get(uid)?.get(t.id) ?? 0,
      }));

    return {
      id:          week.id,
      week_label:  formatWeekRange(week.start_date, week.end_date),
      my_pct:      calcCompletionPercent(toInput(user.id)),
      partner_pct: calcCompletionPercent(toInput(partnerId)),
      task_count:  tasks.length,
      reflections: reflectionsByWeek.get(week.id) ?? [],
    };
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      <PageHeader title="Summary" subtitle="Past weeks and reflections." />

      <div className="space-y-4">
        {entries.map((entry) => (
          <WeekCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

// ─── Week history card ────────────────────────────────────────────────────────

function WeekCard({ entry }: { entry: WeekEntry }) {
  const bothComplete = entry.my_pct === 100 && entry.partner_pct === 100;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-card p-5 space-y-5 transition-colors",
        bothComplete ? "border-accent/30" : "border-border/60"
      )}
    >
      {/* Week label + task count */}
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={cn(
            "text-base font-semibold",
            bothComplete ? "text-accent" : "text-foreground"
          )}
        >
          {entry.week_label}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground">
          {entry.task_count} {entry.task_count === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4">
        <MiniStat label="You"     pct={entry.my_pct}      />
        <MiniStat label="Partner" pct={entry.partner_pct} />
      </div>

      {/* Reflections */}
      {entry.reflections.length > 0 && (
        <div className="space-y-2.5 border-t border-border/60 pt-4">
          {entry.reflections.map((r) => (
            <blockquote
              key={r.id}
              className="text-xs text-muted-foreground leading-relaxed pl-3.5 border-l border-primary/30 italic"
            >
              {r.content}
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mini stat (label + % + bar) ─────────────────────────────────────────────

function MiniStat({ label, pct }: { label: string; pct: number }) {
  const complete = pct === 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            complete ? "text-accent" : "text-foreground"
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            complete ? "bg-accent" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyCard({
  icon,
  title,
  body,
}: {
  icon:  React.ReactNode;
  title: string;
  body:  string;
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

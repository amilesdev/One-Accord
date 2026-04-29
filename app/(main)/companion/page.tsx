import { redirect } from "next/navigation";
import { Check, Users, CalendarDays, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { AutoRefresh } from "@/components/realtime/auto-refresh";
import {
  getActivePartnership,
  getPartnerId,
  getActiveWeekWithProgress,
} from "@/lib/week/queries";
import { ensureActiveWeek } from "@/lib/week/actions";
import { formatWeekRange, calcCompletionPercent } from "@/lib/week/utils";
import { cn } from "@/lib/utils";
import type { TaskWithProgress } from "@/lib/types/database";

export default async function CompanionPage() {
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
        <PageHeader title="Companion" />
        <EmptyCard
          icon={<Users className="h-5 w-5" />}
          title="No partner linked"
          body="Connect with a partner in Settings to see their progress here."
        />
      </div>
    );
  }

  const partnerId = getPartnerId(partnership, user.id);

  const weekResult = await ensureActiveWeek();

  // ── No active week ────────────────────────────────────────────────────────
  if (weekResult.status !== "ok") {
    if (weekResult.status === "error") {
      return (
        <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
          <PageHeader title="Companion" />
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
        <PageHeader title="Companion" />
        <EmptyCard
          icon={<CalendarDays className="h-5 w-5" />}
          title="No active week"
          body="Set up a weekly plan in Settings to get started."
        />
      </div>
    );
  }

  // Fetch both progress sets + partner profile in parallel
  const [myWeek, partnerWeek, partnerResult] = await Promise.all([
    getActiveWeekWithProgress(partnership.id, user.id),
    getActiveWeekWithProgress(partnership.id, partnerId),
    supabase
      .from("users")
      .select("id, display_name, email")
      .eq("id", partnerId)
      .maybeSingle(),
  ]);

  if (!myWeek || !partnerWeek) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <PageHeader title="Companion" />
        <EmptyCard
          icon={<CalendarDays className="h-5 w-5" />}
          title="No active week"
          body="Set up a weekly plan in Settings to get started."
        />
      </div>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const weekLabel = formatWeekRange(myWeek.start_date, myWeek.end_date);

  const toInput = (tasks: TaskWithProgress[]) =>
    tasks.map((t) => ({
      task_type:     t.task_type,
      target_value:  t.target_value,
      current_value: t.progress?.current_value ?? 0,
    }));

  const myPct      = calcCompletionPercent(toInput(myWeek.tasks));
  const partnerPct = calcCompletionPercent(toInput(partnerWeek.tasks));

  const profile     = partnerResult.data;
  const partnerName =
    profile?.display_name ??
    profile?.email?.split("@")[0] ??
    "Partner";

  const partnerValueById = new Map(
    partnerWeek.tasks.map((t) => [t.id, t.progress?.current_value ?? 0])
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      <PageHeader
        title="Companion"
        subtitle={weekLabel}
        action={<LiveDot />}
      />

      {/* ── Side-by-side completion ──────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-2 divide-x divide-border">
          <ComparisonColumn label="You"         pct={myPct}      side="left"  />
          <ComparisonColumn label={partnerName} pct={partnerPct} side="right" />
        </div>
      </div>

      {/* ── Per-task breakdown ───────────────────────────────────── */}
      <div className="space-y-3">
        {myWeek.tasks.map((task) => (
          <TaskComparisonCard
            key={task.id}
            task={task}
            myValue={task.progress?.current_value ?? 0}
            partnerValue={partnerValueById.get(task.id) ?? 0}
            partnerName={partnerName}
          />
        ))}
      </div>

      {/* Polls every 3 s; pauses when tab is hidden */}
      <AutoRefresh intervalMs={3000} />
    </div>
  );
}

// ─── Live indicator ───────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      Live
    </span>
  );
}

// ─── Side-by-side column ──────────────────────────────────────────────────────

function ComparisonColumn({
  label,
  pct,
  side,
}: {
  label: string;
  pct:   number;
  side:  "left" | "right";
}) {
  const complete = pct === 100;

  return (
    <div className={cn("space-y-3", side === "left" ? "pr-5" : "pl-5")}>
      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums leading-none transition-colors duration-300",
            complete ? "text-accent" : "text-foreground"
          )}
        >
          {pct}%
        </p>
      </div>

      <div className="h-1.5 w-full rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", !complete && "bg-primary")}
          style={{
            width: `${pct}%`,
            transition: "width 700ms ease-out",
            background: complete
              ? "linear-gradient(90deg, #c9a84c 0%, #ddb95c 50%, #c9a84c 100%)"
              : undefined,
            boxShadow: complete
              ? "0 0 10px 4px rgba(201,168,76,0.4), 0 0 4px 1px rgba(201,168,76,0.7)"
              : "none",
          }}
        />
      </div>
    </div>
  );
}

// ─── Per-task card ────────────────────────────────────────────────────────────

function TaskComparisonCard({
  task,
  myValue,
  partnerValue,
  partnerName,
}: {
  task:         TaskWithProgress;
  myValue:      number;
  partnerValue: number;
  partnerName:  string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-medium text-foreground">{task.title}</p>

      <div className="space-y-3">
        <ProgressRow label="You"         task={task} value={myValue}      />
        <ProgressRow label={partnerName} task={task} value={partnerValue} />
      </div>
    </div>
  );
}

// ─── Progress row (counter or simple) ────────────────────────────────────────

function ProgressRow({
  label,
  task,
  value,
}: {
  label: string;
  task:  TaskWithProgress;
  value: number;
}) {
  if (task.task_type === "counter") {
    const target   = task.target_value ?? 1;
    const pct      = Math.min(100, Math.round((value / target) * 100));
    const complete = value >= target;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span
            className={cn(
              "text-xs tabular-nums font-medium",
              complete ? "text-accent" : "text-muted-foreground"
            )}
          >
            {value}&thinsp;/&thinsp;{target}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full", !complete && "bg-primary")}
            style={{
              width: `${pct}%`,
              transition: "width 500ms ease-out",
              background: complete
                ? "linear-gradient(90deg, #c9a84c 0%, #ddb95c 50%, #c9a84c 100%)"
                : undefined,
              boxShadow: complete
                ? "0 0 10px 4px rgba(201,168,76,0.4), 0 0 4px 1px rgba(201,168,76,0.7)"
                : "none",
            }}
          />
        </div>
      </div>
    );
  }

  // Simple task
  const complete = value === 1;

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          complete ? "text-accent" : "text-muted-foreground"
        )}
      >
        {complete ? (
          <>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
            </span>
            Done
          </>
        ) : (
          <>
            <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-muted-foreground/30" />
            Not yet
          </>
        )}
      </span>
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

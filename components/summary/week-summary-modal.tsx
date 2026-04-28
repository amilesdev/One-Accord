"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekSummary {
  id:                     string;
  week_label:             string;
  my_completion_pct:      number;
  partner_completion_pct: number;
  task_count:             number;
}

interface WeekSummaryModalProps {
  currentWeekId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "oa_last_seen_week";

// ─── Component ────────────────────────────────────────────────────────────────

export function WeekSummaryModal({ currentWeekId }: WeekSummaryModalProps) {
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen === currentWeekId) return;

    fetch("/api/week/summary")
      .then((r) => r.json())
      .then((json) => {
        const weeks: WeekSummary[] = json?.data?.weeks ?? [];
        if (weeks.length > 0) {
          setSummary(weeks[0]); // newest completed week
          setOpen(true);
        } else {
          localStorage.setItem(STORAGE_KEY, currentWeekId);
        }
      })
      .catch(() => {
        localStorage.setItem(STORAGE_KEY, currentWeekId);
      });
  }, [currentWeekId]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, currentWeekId);
    setOpen(false);
  }

  if (!open || !summary) return null;

  const avg = (summary.my_completion_pct + summary.partner_completion_pct) / 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/20 backdrop-blur-sm px-4 pb-6 sm:pb-0"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Week in review</p>
            <p className="text-base font-semibold text-foreground">
              {summary.week_label}
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <StatRow label="You"     pct={summary.my_completion_pct}      />
          <StatRow label="Partner" pct={summary.partner_completion_pct} />
        </div>

        {/* Encouragement */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {encourage(avg)}
        </p>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/85 active:scale-[0.98] transition-all"
        >
          Start this week
        </button>
      </div>
    </div>
  );
}

// ─── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({ label, pct }: { label: string; pct: number }) {
  const complete = pct === 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
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
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            complete ? "bg-accent" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Encouragement copy ───────────────────────────────────────────────────────

function encourage(avgPct: number): string {
  if (avgPct === 100)
    return "Every task complete — you both finished strong. A full week of faithfulness.";
  if (avgPct >= 75)
    return "A strong week together. Keep building on this momentum going forward.";
  if (avgPct >= 50)
    return "Good progress last week. A new week is a fresh start — keep going.";
  return "Every step counts. This new week is a chance to keep moving forward together.";
}

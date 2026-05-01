"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Undo2 } from "lucide-react";
import { TaskCard } from "@/components/tasks/task-card";
import { ReflectionModal } from "@/components/reflections/reflection-modal";
import { apiIncrement, apiComplete, apiSetValue } from "@/lib/progress/api";
import { calcCompletionPercent } from "@/lib/week/utils";
import { cn } from "@/lib/utils";
import type { TaskWithProgress } from "@/lib/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UndoEntry {
  taskId:        string;
  taskType:      string;
  previousValue: number;
}

interface TaskListProps {
  tasks:                      TaskWithProgress[];
  weekId:                     string;
  weekStatus:                 "active" | "completed";
  initialReflectionTaskIds:   string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskList({
  tasks,
  weekId,
  weekStatus,
  initialReflectionTaskIds,
}: TaskListProps) {
  const [progressMap, setProgressMap] = useState<Map<string, number>>(
    () => new Map(tasks.map((t) => [t.id, t.progress?.current_value ?? 0]))
  );
  const [pendingSet, setPendingSet]   = useState<Set<string>>(new Set());
  const [undoEntry, setUndoEntry]     = useState<UndoEntry | null>(null);

  // Reflection state
  const [reflectionOpen, setReflectionOpen]     = useState<{ taskId: string; title: string } | null>(null);
  const [hasReflectionSet, setHasReflectionSet] = useState<Set<string>>(
    () => new Set(initialReflectionTaskIds)
  );

  const undoTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSetRef = useRef(pendingSet);

  useEffect(
    () => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); },
    []
  );

  useEffect(() => { pendingSetRef.current = pendingSet; });

  useEffect(() => {
    setProgressMap((current) => {
      const next  = new Map(current);
      let   dirty = false;
      for (const task of tasks) {
        if (pendingSetRef.current.has(task.id)) continue;
        const serverVal = task.progress?.current_value ?? 0;
        if (next.get(task.id) !== serverVal) {
          next.set(task.id, serverVal);
          dirty = true;
        }
      }
      return dirty ? next : current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // ── Internal helpers ───────────────────────────────────────────────────────

  function setTaskPending(taskId: string, on: boolean) {
    setPendingSet((prev) => {
      const next = new Set(prev);
      on ? next.add(taskId) : next.delete(taskId);
      return next;
    });
  }

  function commitValue(taskId: string, value: number) {
    setProgressMap((prev) => new Map(prev).set(taskId, value));
  }

  function armUndo(entry: UndoEntry) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoEntry(entry);
    undoTimerRef.current = setTimeout(() => setUndoEntry(null), 4000);
  }

  // ── Core mutation ──────────────────────────────────────────────────────────

  const applyUpdate = useCallback(
    async (
      task:     TaskWithProgress,
      newValue: number,
      persist:  () => Promise<{ error: string | null }>
    ) => {
      const previousValue = progressMap.get(task.id) ?? 0;
      if (newValue === previousValue) return;

      commitValue(task.id, newValue);
      setTaskPending(task.id, true);

      const { error } = await persist();

      setTaskPending(task.id, false);

      if (error) {
        commitValue(task.id, previousValue);
        return;
      }

      armUndo({ taskId: task.id, taskType: task.task_type, previousValue });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressMap]
  );

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleIncrement = useCallback(
    (task: TaskWithProgress) => {
      const current = progressMap.get(task.id) ?? 0;
      if (current >= (task.target_value ?? 0)) return;
      applyUpdate(task, current + 1, () => apiIncrement(task.id));
    },
    [progressMap, applyUpdate]
  );

  const handleDecrement = useCallback(
    (task: TaskWithProgress) => {
      const current = progressMap.get(task.id) ?? 0;
      if (current <= 0) return;
      applyUpdate(task, current - 1, () => apiSetValue(task.id, current - 1));
    },
    [progressMap, applyUpdate]
  );

  const handleToggle = useCallback(
    (task: TaskWithProgress) => {
      const current  = progressMap.get(task.id) ?? 0;
      const newValue = current === 0 ? 1 : 0;
      applyUpdate(task, newValue, () => apiComplete(task.id, newValue === 1));
    },
    [progressMap, applyUpdate]
  );

  // ── Reflection handlers ────────────────────────────────────────────────────

  const handleOpenReflection = useCallback((task: TaskWithProgress) => {
    setReflectionOpen({ taskId: task.id, title: task.title });
  }, []);

  const handleCloseReflection = useCallback((taskId: string, hasContent: boolean) => {
    setReflectionOpen(null);
    if (hasContent) {
      setHasReflectionSet((prev) => new Set(prev).add(taskId));
    }
  }, []);

  // ── Undo ───────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    if (!undoEntry) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const { taskId, taskType, previousValue } = undoEntry;
    setUndoEntry(null);

    commitValue(taskId, previousValue);
    setTaskPending(taskId, true);

    const persist =
      taskType === "simple"
        ? () => apiComplete(taskId, previousValue === 1)
        : () => apiSetValue(taskId, previousValue);

    await persist();
    setTaskPending(taskId, false);
  }, [undoEntry]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const progressData = tasks.map((t) => ({
    task_type:     t.task_type,
    target_value:  t.target_value,
    current_value: progressMap.get(t.id) ?? 0,
  }));
  const pct      = calcCompletionPercent(progressData);
  const complete = pct === 100;

  const prevPctRef      = useRef(pct);
  const [summaryGlowing, setSummaryGlowing] = useState(false);

  useEffect(() => {
    if (pct !== prevPctRef.current) {
      prevPctRef.current = pct;
      if (!complete) {
        setSummaryGlowing(true);
        const t = setTimeout(() => setSummaryGlowing(false), 900);
        return () => clearTimeout(t);
      }
    }
  }, [pct, complete]);

  const done = progressData.filter((t) =>
    t.task_type === "counter"
      ? (t.target_value ?? 0) > 0 && t.current_value >= (t.target_value ?? 0)
      : t.current_value === 1
  ).length;

  // ── Empty state ────────────────────────────────────────────────────────────

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-card p-10 flex flex-col items-center gap-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </span>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">No tasks this week</p>
          <p className="text-sm text-muted-foreground leading-relaxed">Add tasks to your weekly plan in Settings.</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-3">
        {/* ── Summary card ────────────────────────────────────────────────── */}
        <div
          className={cn(
            "rounded-2xl border shadow-card overflow-hidden transition-colors duration-500",
            complete ? "border-accent/40" : "border-border/60"
          )}
          style={{
            background: complete
              ? "linear-gradient(135deg, color-mix(in srgb, #c9a84c 10%, var(--card)), var(--card))"
              : "linear-gradient(135deg, color-mix(in srgb, var(--primary) 7%, var(--card)), var(--card))",
          }}
        >
          <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-4">
            <p className={cn(
              "text-sm font-medium transition-colors duration-300",
              complete ? "text-accent" : "text-muted-foreground"
            )}>
              {complete
                ? "All tasks complete ✓"
                : `${done} of ${tasks.length} tasks done`}
            </p>
            <span className={cn(
              "text-5xl font-bold tabular-nums leading-none tracking-tight shrink-0 transition-colors duration-300",
              complete ? "text-accent" : "text-foreground"
            )}>
              {pct}%
            </span>
          </div>

          <div className="px-5 pb-5">
            <div className="h-1.5 w-full rounded-full bg-black/8 dark:bg-white/10">
              <div
                className={cn("h-full rounded-full", !complete && "bg-primary")}
                style={{
                  width: `${pct}%`,
                  transition: "width 700ms ease-out, box-shadow 700ms ease-out",
                  background: complete
                    ? "linear-gradient(90deg, #c9a84c 0%, #ddb95c 50%, #c9a84c 100%)"
                    : undefined,
                  boxShadow: complete
                    ? "0 0 14px 5px rgba(201,168,76,0.45), 0 0 5px 2px rgba(201,168,76,0.75)"
                    : summaryGlowing
                    ? "0 0 10px 4px rgba(255,255,255,0.65)"
                    : "none",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Task cards ──────────────────────────────────────────────────── */}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            value={progressMap.get(task.id) ?? 0}
            pending={pendingSet.has(task.id)}
            hasReflection={hasReflectionSet.has(task.id)}
            onIncrement={() => handleIncrement(task)}
            onDecrement={() => handleDecrement(task)}
            onToggle={() => handleToggle(task)}
            onOpenReflection={() => handleOpenReflection(task)}
          />
        ))}

        {/* ── Undo banner ─────────────────────────────────────────────────── */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className={cn(
            "flex items-center justify-between rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm px-4 py-2.5 shadow-card",
            "transition-all duration-300",
            undoEntry
              ? "opacity-100 translate-y-0"
              : "opacity-0 pointer-events-none translate-y-2"
          )}
        >
          <span className="text-xs text-muted-foreground">Saved</span>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-secondary"
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </button>
        </div>
      </div>

      {/* ── Reflection modal ─────────────────────────────────────────────── */}
      {reflectionOpen && (
        <ReflectionModal
          weekId={weekId}
          weekStatus={weekStatus}
          taskId={reflectionOpen.taskId}
          taskTitle={reflectionOpen.title}
          onClose={handleCloseReflection}
        />
      )}
    </>
  );
}

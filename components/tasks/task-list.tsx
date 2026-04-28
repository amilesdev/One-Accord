"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Undo2 } from "lucide-react";
import { TaskCard } from "@/components/tasks/task-card";
import { apiIncrement, apiComplete, apiSetValue } from "@/lib/progress/api";
import { calcCompletionPercent } from "@/lib/week/utils";
import { cn } from "@/lib/utils";
import type { TaskWithProgress } from "@/lib/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Tracks enough info to reverse the last action via the API. */
interface UndoEntry {
  taskId:        string;
  taskType:      string;
  previousValue: number;
}

interface TaskListProps {
  tasks:     TaskWithProgress[];
  weekLabel: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskList({ tasks, weekLabel }: TaskListProps) {
  /**
   * Client-owned progress map: taskId → current_value.
   * Seeded from server props once; mutations are applied locally and
   * persisted in the background. The server is the source of truth on
   * next page load.
   */
  const [progressMap, setProgressMap] = useState<Map<string, number>>(
    () => new Map(tasks.map((t) => [t.id, t.progress?.current_value ?? 0]))
  );

  // Tasks waiting on an in-flight API call (controls are disabled)
  const [pendingSet, setPendingSet] = useState<Set<string>>(new Set());

  // One undo entry at a time — the most recent mutating action
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  const undoTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref keeps pendingSet readable inside effects without stale-closure risk
  const pendingSetRef = useRef(pendingSet);

  useEffect(
    () => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); },
    []
  );

  // Keep the ref in sync on every render
  useEffect(() => { pendingSetRef.current = pendingSet; });

  // Reconcile with server data when router.refresh() delivers new props.
  // Skips tasks that have in-flight mutations so optimistic values are preserved.
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

  /**
   * Optimistically updates local state, calls the appropriate API endpoint,
   * then reverts if the call fails.
   */
  const applyUpdate = useCallback(
    async (
      task:      TaskWithProgress,
      newValue:  number,
      persist:   () => Promise<{ error: string | null }>
    ) => {
      const previousValue = progressMap.get(task.id) ?? 0;
      if (newValue === previousValue) return;

      // 1. Optimistic update — immediate
      commitValue(task.id, newValue);
      setTaskPending(task.id, true);

      // 2. Persist via API
      const { error } = await persist();

      setTaskPending(task.id, false);

      if (error) {
        commitValue(task.id, previousValue); // revert
        return;
      }

      // 3. Arm undo for 4 s
      armUndo({ taskId: task.id, taskType: task.task_type, previousValue });
    },
    // progressMap reference changes on every update; useCallback still helps
    // by avoiding stale captures of other deps.
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

  // ── Undo ───────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    if (!undoEntry) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const { taskId, taskType, previousValue } = undoEntry;
    setUndoEntry(null);

    commitValue(taskId, previousValue);
    setTaskPending(taskId, true);

    // Route the undo to the correct endpoint
    const persist =
      taskType === "simple"
        ? () => apiComplete(taskId, previousValue === 1)
        : () => apiSetValue(taskId, previousValue);

    await persist();
    setTaskPending(taskId, false);
    // No re-arm — undo is one level only
  }, [undoEntry]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const progressData = tasks.map((t) => ({
    task_type:     t.task_type,
    target_value:  t.target_value,
    current_value: progressMap.get(t.id) ?? 0,
  }));
  const pct      = calcCompletionPercent(progressData);
  const complete = pct === 100;
  const done     = progressData.filter((t) =>
    t.task_type === "counter"
      ? (t.target_value ?? 0) > 0 && t.current_value >= (t.target_value ?? 0)
      : t.current_value === 1
  ).length;

  // ── Empty state ────────────────────────────────────────────────────────────

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-1.5">
        <p className="text-sm font-medium text-foreground">No tasks this week</p>
        <p className="text-xs text-muted-foreground">
          Add tasks to your weekly plan in Settings.
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* ── Summary card ────────────────────────────────────────────────── */}
      <div
        className={cn(
          "rounded-2xl border bg-card p-5 space-y-3 transition-colors duration-500",
          complete ? "border-accent/50" : "border-border"
        )}
      >
        <div className="flex items-end justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{weekLabel}</p>
            <p className={cn(
              "text-sm font-semibold transition-colors duration-300",
              complete ? "text-accent" : "text-foreground"
            )}>
              {complete
                ? "All tasks complete"
                : `${done} of ${tasks.length} complete`}
            </p>
          </div>
          <span className={cn(
            "text-2xl font-semibold tabular-nums leading-none transition-colors duration-300",
            complete ? "text-accent" : "text-foreground"
          )}>
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
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

      {/* ── Task cards ──────────────────────────────────────────────────── */}
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          value={progressMap.get(task.id) ?? 0}
          pending={pendingSet.has(task.id)}
          onIncrement={() => handleIncrement(task)}
          onDecrement={() => handleDecrement(task)}
          onToggle={() => handleToggle(task)}
        />
      ))}

      {/* ── Undo banner ─────────────────────────────────────────────────── */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5",
          "transition-all duration-300",
          undoEntry
            ? "opacity-100 translate-y-0"
            : "opacity-0 pointer-events-none translate-y-1"
        )}
      >
        <span className="text-xs text-muted-foreground">Saved</span>
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-secondary"
        >
          <Undo2 className="h-3 w-3" />
          Undo
        </button>
      </div>
    </div>
  );
}

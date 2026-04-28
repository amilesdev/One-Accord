"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Undo2 } from "lucide-react";
import { TaskCard } from "@/components/tasks/task-card";
import { saveProgressValue } from "@/lib/progress/actions";
import { calcCompletionPercent } from "@/lib/week/utils";
import { cn } from "@/lib/utils";
import type { TaskWithProgress } from "@/lib/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UndoEntry {
  progressId:    string;
  taskId:        string;
  previousValue: number;
  currentValue:  number;
}

interface TaskListProps {
  tasks:         TaskWithProgress[];
  weekLabel:     string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskList({ tasks, weekLabel }: TaskListProps) {
  // Client-managed progress map: taskId → current_value.
  // Initialised once from server props; owned by the client from there on.
  const [progressMap, setProgressMap] = useState<Map<string, number>>(
    () => new Map(tasks.map((t) => [t.id, t.progress?.current_value ?? 0]))
  );

  // Task IDs currently waiting on a server round-trip
  const [pendingSet, setPendingSet] = useState<Set<string>>(new Set());

  // Undo state: only one entry at a time (last action)
  const [undoEntry, setUndoEntry]     = useState<UndoEntry | null>(null);
  const undoTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up the undo timer when component unmounts
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  // ── Core update ────────────────────────────────────────────────────────────

  const applyUpdate = useCallback(
    async (task: TaskWithProgress, newValue: number) => {
      if (!task.progress) return;

      const progressId    = task.progress.id;
      const previousValue = progressMap.get(task.id) ?? 0;

      if (newValue === previousValue) return;

      // 1. Optimistic update
      commitValue(task.id, newValue);
      setTaskPending(task.id, true);

      // 2. Persist
      const { error } = await saveProgressValue(progressId, newValue);

      setTaskPending(task.id, false);

      if (error) {
        // Revert on failure
        commitValue(task.id, previousValue);
        return;
      }

      // 3. Arm undo
      armUndo({ progressId, taskId: task.id, previousValue, currentValue: newValue });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressMap]
  );

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleIncrement = useCallback(
    (task: TaskWithProgress) => {
      const current = progressMap.get(task.id) ?? 0;
      const target  = task.target_value ?? 0;
      if (current >= target) return;
      applyUpdate(task, current + 1);
    },
    [progressMap, applyUpdate]
  );

  const handleDecrement = useCallback(
    (task: TaskWithProgress) => {
      const current = progressMap.get(task.id) ?? 0;
      if (current <= 0) return;
      applyUpdate(task, current - 1);
    },
    [progressMap, applyUpdate]
  );

  const handleToggle = useCallback(
    (task: TaskWithProgress) => {
      const current  = progressMap.get(task.id) ?? 0;
      const newValue = current === 0 ? 1 : 0;
      applyUpdate(task, newValue);
    },
    [progressMap, applyUpdate]
  );

  // ── Undo ───────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    if (!undoEntry) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const { progressId, taskId, previousValue, currentValue } = undoEntry;
    setUndoEntry(null);

    // Optimistic revert
    commitValue(taskId, previousValue);
    setTaskPending(taskId, true);

    await saveProgressValue(progressId, previousValue);

    setTaskPending(taskId, false);
    // Do NOT re-arm undo after an undo — one level only
    void currentValue; // used for reference but undo is non-recursive
  }, [undoEntry]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const progressData = tasks.map((t) => ({
    task_type:    t.task_type,
    target_value: t.target_value,
    current_value: progressMap.get(t.id) ?? 0,
  }));
  const completionPct = calcCompletionPercent(progressData);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">No tasks this week</p>
        <p className="text-xs text-muted-foreground">
          Add tasks to your weekly plan in Settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week progress summary */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Weekly progress</span>
          <span
            className={cn(
              "text-sm tabular-nums font-medium transition-colors duration-300",
              completionPct === 100 ? "text-accent" : "text-muted-foreground"
            )}
          >
            {completionPct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              completionPct === 100 ? "bg-accent" : "bg-primary"
            )}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{weekLabel}</p>
      </div>

      {/* Task cards */}
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

      {/* Undo banner */}
      <div
        className={cn(
          "flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3",
          "transition-all duration-300",
          undoEntry
            ? "opacity-100 translate-y-0"
            : "opacity-0 pointer-events-none translate-y-1"
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="text-xs text-muted-foreground">Progress saved</span>
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>
      </div>
    </div>
  );
}

import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskWithProgress } from "@/lib/types/database";

interface TaskCardProps {
  task:       TaskWithProgress;
  value:      number;
  pending:    boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onToggle:    () => void;
}

export function TaskCard({
  task,
  value,
  pending,
  onIncrement,
  onDecrement,
  onToggle,
}: TaskCardProps) {
  if (task.task_type === "counter") {
    return (
      <CounterTask
        task={task}
        value={value}
        pending={pending}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />
    );
  }

  return (
    <SimpleTask
      task={task}
      value={value}
      pending={pending}
      onToggle={onToggle}
    />
  );
}

// ─── Counter task ─────────────────────────────────────────────────────────────

function CounterTask({
  task,
  value,
  pending,
  onIncrement,
  onDecrement,
}: {
  task:        TaskWithProgress;
  value:       number;
  pending:     boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const target    = task.target_value ?? 1;
  const pct       = Math.min(100, Math.round((value / target) * 100));
  const complete  = value >= target;
  const atMin     = value <= 0;
  const atMax     = value >= target;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 transition-colors duration-300",
        complete ? "border-accent/40" : "border-border"
      )}
    >
      {/* Title row */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-sm font-medium transition-colors duration-300",
            complete ? "text-accent" : "text-foreground"
          )}
        >
          {task.title}
        </span>
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums transition-colors duration-300",
            complete ? "text-accent font-semibold" : "text-muted-foreground"
          )}
        >
          {value} / {target}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            complete ? "bg-accent" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <IconButton
          onClick={onDecrement}
          disabled={pending || atMin}
          aria-label="Decrease"
        >
          <Minus className="h-4 w-4" />
        </IconButton>

        {complete ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <Check className="h-3.5 w-3.5" />
            Complete
          </span>
        ) : (
          <div className="h-px flex-1 mx-4 bg-border" />
        )}

        <IconButton
          onClick={onIncrement}
          disabled={pending || atMax}
          aria-label="Increase"
          highlighted={!complete}
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

// ─── Simple task ──────────────────────────────────────────────────────────────

function SimpleTask({
  task,
  value,
  pending,
  onToggle,
}: {
  task:     TaskWithProgress;
  value:    number;
  pending:  boolean;
  onToggle: () => void;
}) {
  const complete = value === 1;

  return (
    <button
      onClick={onToggle}
      disabled={pending}
      className={cn(
        "group w-full rounded-2xl border bg-card p-5 text-left",
        "flex items-center gap-4",
        "transition-colors duration-200",
        "disabled:pointer-events-none disabled:opacity-60",
        complete
          ? "border-accent/40 hover:border-accent/60"
          : "border-border hover:border-primary/40"
      )}
    >
      {/* Check circle */}
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
          "transition-all duration-300",
          complete
            ? "border-accent bg-accent text-white"
            : "border-muted-foreground/40 group-hover:border-primary/60"
        )}
      >
        {complete && <Check className="h-3.5 w-3.5" />}
      </span>

      {/* Label */}
      <span
        className={cn(
          "text-sm font-medium transition-colors duration-300",
          complete
            ? "text-muted-foreground line-through decoration-muted-foreground/40"
            : "text-foreground"
        )}
      >
        {task.title}
      </span>
    </button>
  );
}

// ─── Shared icon button ───────────────────────────────────────────────────────

function IconButton({
  children,
  disabled,
  highlighted,
  onClick,
  "aria-label": ariaLabel,
}: {
  children:     React.ReactNode;
  disabled:     boolean;
  highlighted?: boolean;
  onClick:      () => void;
  "aria-label": string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl",
        "transition-all duration-200 active:scale-95",
        "disabled:pointer-events-none disabled:opacity-30",
        highlighted
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-secondary text-foreground hover:bg-secondary/70"
      )}
    >
      {children}
    </button>
  );
}

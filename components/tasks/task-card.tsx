"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Minus, Plus, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskWithProgress } from "@/lib/types/database";

interface TaskCardProps {
  task:             TaskWithProgress;
  value:            number;
  pending:          boolean;
  hasReflection:    boolean;
  onIncrement:      () => void;
  onDecrement:      () => void;
  onToggle:         () => void;
  onOpenReflection: () => void;
}

export function TaskCard(props: TaskCardProps) {
  return props.task.task_type === "counter" ? (
    <CounterTask {...props} />
  ) : (
    <SimpleTask {...props} />
  );
}

// ─── Counter task ─────────────────────────────────────────────────────────────

function CounterTask({
  task,
  value,
  pending,
  hasReflection,
  onIncrement,
  onDecrement,
  onOpenReflection,
}: TaskCardProps) {
  const target   = task.target_value ?? 1;
  const pct      = Math.min(100, Math.round((value / target) * 100));
  const complete = value >= target;

  const prevValueRef = useRef(value);
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (!complete) {
        setGlowing(true);
        const t = setTimeout(() => setGlowing(false), 900);
        return () => clearTimeout(t);
      }
    }
  }, [value, complete]);

  const barShadow = complete
    ? "0 0 14px 5px rgba(201,168,76,0.45), 0 0 5px 2px rgba(201,168,76,0.75)"
    : glowing
    ? "0 0 10px 4px rgba(255,255,255,0.65)"
    : "none";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card transition-colors duration-300",
        complete ? "border-accent/40" : "border-border",
        pending && "opacity-80"
      )}
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <span className={cn(
            "text-sm font-medium leading-snug transition-colors duration-300",
            complete ? "text-accent" : "text-foreground"
          )}>
            {task.title}
          </span>

          <span className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
            "transition-all duration-300",
            complete
              ? "bg-accent/15 text-accent"
              : "bg-secondary text-muted-foreground"
          )}>
            {value}&thinsp;/&thinsp;{target}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full", !complete && "bg-primary")}
            style={{
              width: `${pct}%`,
              transition: "width 600ms ease-out, box-shadow 700ms ease-out",
              background: complete
                ? "linear-gradient(90deg, #c9a84c 0%, #ddb95c 50%, #c9a84c 100%)"
                : undefined,
              boxShadow: barShadow,
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className={cn(
        "flex items-center justify-between border-t px-4 py-3 transition-colors duration-300",
        complete ? "border-accent/20" : "border-border"
      )}>
        <StepButton
          onClick={onDecrement}
          disabled={pending || value <= 0}
          aria-label="Decrease by 1"
        >
          <Minus className="h-3.5 w-3.5" />
        </StepButton>

        {complete ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Complete
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {target - value} more to go
          </span>
        )}

        <div className="flex items-center gap-2">
          {/* Reflection indicator / button */}
          <button
            onClick={onOpenReflection}
            aria-label={hasReflection ? "View reflection" : "Add reflection"}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-secondary"
          >
            {hasReflection ? (
              <span className="h-2 w-2 rounded-full bg-accent/70" />
            ) : (
              <PenLine className="h-3.5 w-3.5 text-muted-foreground/30 transition-colors hover:text-muted-foreground" />
            )}
          </button>

          <StepButton
            onClick={onIncrement}
            disabled={pending || value >= target}
            primary={!complete}
            aria-label="Add 1"
          >
            <Plus className="h-3.5 w-3.5" />
          </StepButton>
        </div>
      </div>
    </div>
  );
}

// ─── Simple task ──────────────────────────────────────────────────────────────

function SimpleTask({ task, value, pending, hasReflection, onToggle, onOpenReflection }: TaskCardProps) {
  const complete = value === 1;

  return (
    <div
      className={cn(
        "w-full rounded-2xl border bg-card",
        "flex items-stretch",
        "transition-colors duration-200",
        pending && "opacity-75",
        complete
          ? "border-accent/40"
          : "border-border hover:border-primary/30"
      )}
    >
      {/* Toggle area */}
      <button
        onClick={onToggle}
        disabled={pending}
        className={cn(
          "flex flex-1 items-center gap-4 px-5 py-4 text-left",
          "active:scale-[0.99] transition-transform duration-150",
          "disabled:pointer-events-none",
        )}
      >
        {/* Circle indicator */}
        <span className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          "border-2 transition-all duration-300",
          complete ? "border-accent bg-accent" : "border-muted-foreground/30"
        )}>
          {complete && <Check className="h-3 w-3 text-white" strokeWidth={2.5} />}
        </span>

        {/* Label */}
        <span className={cn(
          "text-sm font-medium transition-all duration-300",
          complete
            ? "text-muted-foreground line-through decoration-muted-foreground/30"
            : "text-foreground"
        )}>
          {task.title}
        </span>
      </button>

      {/* Reflection button */}
      <button
        onClick={onOpenReflection}
        aria-label={hasReflection ? "View reflection" : "Add reflection"}
        className="flex items-center justify-center px-4 transition-colors hover:bg-secondary/50 rounded-r-2xl"
      >
        {hasReflection ? (
          <span className="h-2 w-2 rounded-full bg-accent/70" />
        ) : (
          <PenLine className="h-3.5 w-3.5 text-muted-foreground/30 transition-colors" />
        )}
      </button>
    </div>
  );
}

// ─── Step button (counter ±) ──────────────────────────────────────────────────

function StepButton({
  children,
  disabled,
  primary,
  onClick,
  "aria-label": ariaLabel,
}: {
  children:     React.ReactNode;
  disabled:     boolean;
  primary?:     boolean;
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
        "transition-all duration-150 active:scale-90",
        "disabled:pointer-events-none disabled:opacity-25",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/85 shadow-sm"
          : "bg-secondary text-foreground hover:bg-secondary/70"
      )}
    >
      {children}
    </button>
  );
}

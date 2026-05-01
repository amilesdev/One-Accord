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
        "rounded-2xl border bg-card shadow-card transition-colors duration-300",
        complete ? "border-accent/35" : "border-border/60",
        pending && "opacity-80"
      )}
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <span className={cn(
            "text-base font-medium leading-snug transition-colors duration-300",
            complete ? "text-accent" : "text-foreground"
          )}>
            {task.title}
          </span>

          <span className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums mt-0.5",
            "transition-all duration-300",
            complete
              ? "bg-accent/15 text-accent"
              : "bg-secondary text-muted-foreground"
          )}>
            {value}&thinsp;/&thinsp;{target}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-secondary">
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
        complete ? "border-accent/20" : "border-border/60"
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
              <ReflectionWrittenIcon />
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
    <div className={cn(
      "rounded-2xl border bg-card shadow-card transition-colors duration-200",
      pending && "opacity-75",
      complete ? "border-accent/35" : "border-border/60",
    )}>
      {/* Title */}
      <div className="px-5 py-5">
        <span className={cn(
          "text-base font-medium leading-snug transition-all duration-300",
          complete
            ? "text-muted-foreground line-through decoration-muted-foreground/30"
            : "text-foreground"
        )}>
          {task.title}
        </span>
      </div>

      {/* Controls — mirrors counter task footer */}
      <div className={cn(
        "flex items-center justify-end border-t px-4 py-3 transition-colors duration-300",
        complete ? "border-accent/20" : "border-border/60",
      )}>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenReflection}
            aria-label={hasReflection ? "View reflection" : "Add reflection"}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-secondary"
          >
            {hasReflection ? (
              <ReflectionWrittenIcon />
            ) : (
              <PenLine className="h-3.5 w-3.5 text-muted-foreground/30 transition-colors hover:text-muted-foreground" />
            )}
          </button>

          <StepButton
            onClick={onToggle}
            disabled={pending}
            primary={!complete}
            aria-label={complete ? "Mark incomplete" : "Mark complete"}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </StepButton>
        </div>
      </div>
    </div>
  );
}

// ─── Reflection "has content" icon ────────────────────────────────────────────

function ReflectionWrittenIcon() {
  return (
    <span className="flex flex-col items-center gap-[2px]">
      <PenLine className="h-3 w-3 text-foreground" strokeWidth={2.5} />
      <svg width="10" height="4" viewBox="0 0 10 4" fill="none" className="text-foreground">
        <path
          d="M0 2 Q1.25 0.5 2.5 2 Q3.75 3.5 5 2 Q6.25 0.5 7.5 2 Q8.75 3.5 10 2"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
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
        "transition-all duration-150 active:scale-[0.88]",
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

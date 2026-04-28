"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  DbPartnership,
  DbWeeklyTemplate,
  TemplateTaskDefinition,
} from "@/lib/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskDraft {
  id:           string;
  title:        string;
  task_type:    "simple" | "counter";
  target_value: number;
}

export interface SettingsClientProps {
  initialTemplate:  DbWeeklyTemplate | null;
  partnership:      DbPartnership | null;
  pendingInviteCode: string | null;
  partnerProfile:   { display_name: string | null; email: string } | null;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function SettingsClient({
  initialTemplate,
  partnership,
  pendingInviteCode,
  partnerProfile,
}: SettingsClientProps) {
  return (
    <div className="space-y-4">
      <WeeklyPlanSection
        initialTemplate={initialTemplate}
        hasPartnership={!!partnership}
      />
      <PartnerSection
        partnership={partnership}
        pendingInviteCode={pendingInviteCode}
        partnerProfile={partnerProfile}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Weekly plan
// ═══════════════════════════════════════════════════════════════════════════════

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function WeeklyPlanSection({
  initialTemplate,
  hasPartnership,
}: {
  initialTemplate: DbWeeklyTemplate | null;
  hasPartnership:  boolean;
}) {
  const [weekStartDay, setWeekStartDay] = useState(
    initialTemplate?.week_start_day ?? 0
  );
  const [tasks, setTasks] = useState<TaskDraft[]>(() =>
    (initialTemplate?.task_definitions ?? []).map((t) => ({
      id:           t.id,
      title:        t.title,
      task_type:    t.task_type,
      target_value: t.target_value ?? 1,
    }))
  );
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // ── Mutations ────────────────────────────────────────────────────────────────

  function addTask() {
    setTasks((prev) => [
      ...prev,
      {
        id:           crypto.randomUUID(),
        title:        "",
        task_type:    "simple",
        target_value: 1,
      },
    ]);
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function patchTask(id: string, patch: Partial<TaskDraft>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function save() {
    setSaveStatus("saving");

    const taskDefs: TemplateTaskDefinition[] = tasks
      .filter((t) => t.title.trim().length > 0)
      .map((t, i) => ({
        id:         t.id,
        title:      t.title.trim(),
        task_type:  t.task_type,
        sort_order: i,
        ...(t.task_type === "counter" ? { target_value: t.target_value } : {}),
      }));

    const res = await fetch("/api/template", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        week_start_day:   weekStartDay,
        task_definitions: taskDefs,
      }),
    });

    if (res.ok) {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } else {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  const canSave =
    hasPartnership &&
    saveStatus !== "saving" &&
    tasks.some((t) => t.title.trim().length > 0);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-sm font-semibold text-foreground">Weekly Plan</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Changes apply to your next week
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* Week start day */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Week starts on
          </p>
          <div className="flex gap-1">
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => setWeekStartDay(i)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-medium transition-all duration-150",
                  weekStartDay === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tasks</p>

          {tasks.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">
              No tasks yet — add one below.
            </p>
          )}

          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onChange={(patch) => patchTask(task.id, patch)}
                onRemove={() => removeTask(task.id)}
              />
            ))}
          </div>

          <button
            onClick={addTask}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/75 transition-colors py-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </button>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-1 border-t border-border">
          <Button
            onClick={save}
            disabled={!canSave}
            className="mt-4 gap-2"
          >
            {saveStatus === "saving" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {saveStatus === "saved" && <Check className="h-3.5 w-3.5" />}
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
              ? "Saved"
              : "Save plan"}
          </Button>

          {!hasPartnership && (
            <p className="mt-4 text-xs text-muted-foreground">
              Link a partner first
            </p>
          )}
          {saveStatus === "error" && (
            <p className="mt-4 text-xs text-destructive">
              Something went wrong. Try again.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onChange,
  onRemove,
}: {
  task:     TaskDraft;
  onChange: (patch: Partial<TaskDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={task.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Task name"
          className="h-9 flex-1 min-w-0"
        />

        <TypeToggle
          value={task.task_type}
          onChange={(type) =>
            onChange({
              task_type:    type,
              target_value: task.target_value || 1,
            })
          }
        />

        <button
          onClick={onRemove}
          aria-label="Remove task"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {task.task_type === "counter" && (
        <div className="flex items-center gap-2 pl-0.5">
          <span className="text-xs text-muted-foreground">Target</span>
          <input
            type="number"
            min={1}
            max={99}
            value={task.target_value}
            onChange={(e) =>
              onChange({
                target_value: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            className={cn(
              "w-16 h-8 rounded-lg border border-input bg-card px-2 text-sm",
              "text-foreground text-center tabular-nums",
              "focus-visible:outline-none focus-visible:border-primary transition-colors"
            )}
          />
          <span className="text-xs text-muted-foreground">times</span>
        </div>
      )}
    </div>
  );
}

// ─── Simple / Counter toggle ──────────────────────────────────────────────────

function TypeToggle({
  value,
  onChange,
}: {
  value:    "simple" | "counter";
  onChange: (v: "simple" | "counter") => void;
}) {
  return (
    <div className="flex h-9 shrink-0 rounded-lg border border-border overflow-hidden">
      {(["simple", "counter"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "px-3 text-xs font-medium transition-all duration-150",
            value === t
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-secondary"
          )}
        >
          {t === "simple" ? "Simple" : "Counter"}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Partner
// ═══════════════════════════════════════════════════════════════════════════════

function PartnerSection({
  partnership,
  pendingInviteCode,
  partnerProfile,
}: {
  partnership:      DbPartnership | null;
  pendingInviteCode: string | null;
  partnerProfile:   { display_name: string | null; email: string } | null;
}) {
  const [inviteCode,   setInviteCode]   = useState<string | null>(pendingInviteCode);
  const [loadingCode,  setLoadingCode]  = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [inputCode,    setInputCode]    = useState("");
  const [linking,      setLinking]      = useState(false);
  const [linkStatus,   setLinkStatus]   = useState<"idle" | "success" | "error">("idle");
  const [linkMessage,  setLinkMessage]  = useState("");

  const partnerName =
    partnerProfile?.display_name ??
    partnerProfile?.email?.split("@")[0] ??
    "Partner";

  async function generateInvite() {
    setLoadingCode(true);
    const res  = await fetch("/api/partner/invite", { method: "POST" });
    const json = await res.json();
    setInviteCode(json?.data?.partnership?.invite_code ?? null);
    setLoadingCode(false);
  }

  async function copyCode() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function linkPartner() {
    if (!inputCode.trim()) return;
    setLinking(true);
    setLinkStatus("idle");

    const res  = await fetch("/api/partner/link", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ invite_code: inputCode.trim().toUpperCase() }),
    });
    const json = await res.json();

    if (res.ok) {
      setLinkStatus("success");
      setLinkMessage("Partner linked! Refresh to continue.");
    } else {
      setLinkStatus("error");
      setLinkMessage(json?.error ?? "Something went wrong.");
    }
    setLinking(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="text-sm font-semibold text-foreground">Partner</p>
      </div>

      <div className="p-5">
        {/* ── Active ──────────────────────────────────────────────── */}
        {partnership?.status === "active" && (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent text-sm font-semibold">
              {partnerName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {partnerName}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <UserCheck className="h-3 w-3 text-accent" />
                <p className="text-xs text-accent">Active partnership</p>
              </div>
            </div>
          </div>
        )}

        {/* ── No active partnership ────────────────────────────────── */}
        {(!partnership || partnership.status !== "active") && (
          <div className="space-y-5">
            {/* Generate / show invite code */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Invite your partner
              </p>

              {!inviteCode ? (
                <Button
                  variant="outline"
                  onClick={generateInvite}
                  disabled={loadingCode}
                  className="w-full"
                >
                  {loadingCode && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Get an invite code
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-center font-mono text-base font-semibold tracking-[0.25em] text-foreground select-all">
                    {inviteCode}
                  </div>
                  <button
                    onClick={copyCode}
                    aria-label="Copy invite code"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-accent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground">or enter a code</span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* Link with code */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Have a code?
              </p>
              <div className="flex gap-2">
                <Input
                  value={inputCode}
                  onChange={(e) =>
                    setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="XXXXXXXX"
                  maxLength={8}
                  className="font-mono tracking-[0.2em] text-center uppercase"
                />
                <Button
                  onClick={linkPartner}
                  disabled={linking || inputCode.trim().length < 6}
                >
                  {linking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Link"
                  )}
                </Button>
              </div>

              {linkStatus !== "idle" && (
                <p
                  className={cn(
                    "text-xs",
                    linkStatus === "success"
                      ? "text-accent"
                      : "text-destructive"
                  )}
                >
                  {linkMessage}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

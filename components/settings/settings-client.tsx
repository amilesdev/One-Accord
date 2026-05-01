"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  UserCheck,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
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
  userId:           string;
  userDisplayName:  string | null;
  userEmail:        string;
  userInviteCode:   string | null;
  initialTemplate:  DbWeeklyTemplate | null;
  partnership:      DbPartnership | null;
  pendingInviteCode: string | null;
  partnerProfile:   { display_name: string | null; email: string } | null;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function SettingsClient({
  userId,
  userDisplayName,
  userEmail,
  userInviteCode,
  initialTemplate,
  partnership,
  pendingInviteCode,
  partnerProfile,
}: SettingsClientProps) {
  return (
    <div className="space-y-4">
      <ProfileSection
        userId={userId}
        initialDisplayName={userDisplayName}
        userEmail={userEmail}
        initialInviteCode={userInviteCode}
      />
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
// Profile
// ═══════════════════════════════════════════════════════════════════════════════

function ProfileSection({
  userId,
  initialDisplayName,
  userEmail,
  initialInviteCode,
}: {
  userId:              string;
  initialDisplayName:  string | null;
  userEmail:           string;
  initialInviteCode:   string | null;
}) {
  const [open, setOpen] = useState(false);

  const [displayName,   setDisplayName]   = useState(initialDisplayName ?? "");
  const [nameStatus,    setNameStatus]    = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [email,         setEmail]         = useState(userEmail);
  const [emailStatus,   setEmailStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [newPassword,   setNewPassword]   = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");
  const [pwStatus,      setPwStatus]      = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [inviteCode,    setInviteCode]    = useState<string | null>(initialInviteCode);
  const [loadingCode,   setLoadingCode]   = useState(false);
  const [copied,        setCopied]        = useState(false);

  async function saveDisplayName() {
    if (!displayName.trim()) return;
    setNameStatus("saving");
    const supabase = createClient();
    const [authRes, dbRes] = await Promise.all([
      supabase.auth.updateUser({ data: { display_name: displayName.trim() } }),
      supabase.from("users").update({ display_name: displayName.trim() }).eq("id", userId),
    ]);
    if (authRes.error || dbRes.error) {
      setNameStatus("error");
    } else {
      setNameStatus("saved");
    }
    setTimeout(() => setNameStatus("idle"), 2500);
  }

  async function saveEmail() {
    if (!email.trim() || email.trim() === userEmail) return;
    setEmailStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setEmailStatus(error ? "error" : "saved");
    setTimeout(() => setEmailStatus("idle"), 4000);
  }

  async function savePassword() {
    if (newPassword.length < 8 || newPassword !== confirmPw) return;
    setPwStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwStatus("error");
    } else {
      setPwStatus("saved");
      setNewPassword("");
      setConfirmPw("");
    }
    setTimeout(() => setPwStatus("idle"), 2500);
  }

  async function generateCode() {
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

  const pwMismatch = confirmPw.length > 0 && newPassword !== confirmPw;

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/30"
      >
        <div>
          <p className="text-base font-semibold text-foreground">Profile</p>
          {!open && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">Tap to edit</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border/60 p-5 space-y-6">

          {/* ── Display name ───────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
              <Button
                onClick={saveDisplayName}
                disabled={nameStatus === "saving" || !displayName.trim()}
                className="shrink-0 gap-1.5"
              >
                {nameStatus === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {nameStatus === "saved"  && <Check   className="h-3.5 w-3.5" />}
                {nameStatus === "saving" ? "Saving…" : nameStatus === "saved" ? "Saved" : "Save"}
              </Button>
            </div>
            {nameStatus === "error" && (
              <p className="text-xs text-destructive">Failed to update name.</p>
            )}
          </div>

          {/* ── Email ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <div className="flex gap-2">
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                onClick={saveEmail}
                disabled={emailStatus === "saving" || email.trim() === userEmail}
                variant="outline"
                className="shrink-0 gap-1.5"
              >
                {emailStatus === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {emailStatus === "saving" ? "Saving…" : emailStatus === "saved" ? "Check email" : "Update"}
              </Button>
            </div>
            {emailStatus === "saved" && (
              <p className="text-xs text-primary">Confirmation sent — check your inbox.</p>
            )}
            {emailStatus === "error" && (
              <p className="text-xs text-destructive">Failed to update email.</p>
            )}
          </div>

          {/* ── Password ───────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>New password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
            />
            <Input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirm new password"
              className={cn(pwMismatch && "border-destructive focus-visible:border-destructive")}
            />
            {pwMismatch && (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            )}
            <Button
              onClick={savePassword}
              disabled={pwStatus === "saving" || newPassword.length < 8 || pwMismatch || newPassword !== confirmPw}
              variant="outline"
              className="w-full gap-1.5"
            >
              {pwStatus === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {pwStatus === "saved"  && <Check   className="h-3.5 w-3.5" />}
              {pwStatus === "saving" ? "Updating…" : pwStatus === "saved" ? "Updated" : "Update password"}
            </Button>
            {pwStatus === "error" && (
              <p className="text-xs text-destructive">Failed to update password.</p>
            )}
          </div>

          {/* ── Invite code ────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Your invite code</p>
            {inviteCode ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-xl border border-border/60 bg-secondary px-4 py-2.5 text-center font-mono text-base font-semibold tracking-[0.25em] text-foreground select-all">
                  {inviteCode}
                </div>
                <button
                  onClick={copyCode}
                  aria-label="Copy invite code"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:bg-secondary transition-colors"
                >
                  {copied
                    ? <Check className="h-4 w-4 text-accent" />
                    : <Copy  className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <Button variant="outline" onClick={generateCode} disabled={loadingCode} className="w-full">
                {loadingCode && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Generate invite code
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Share this with your accountability partner to connect.
            </p>
          </div>

        </div>
      )}
    </section>
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
  const [open,       setOpen]       = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  function addTask() {
    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: "", task_type: "simple", target_value: 1 },
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
      body:    JSON.stringify({ week_start_day: weekStartDay, task_definitions: taskDefs }),
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

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/30"
      >
        <div>
          <p className="text-base font-semibold text-foreground">Weekly Plan</p>
          {!open && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">Tap to edit</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border/60 p-5 space-y-5">
          {/* Week start day */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Week starts on</p>
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
              <p className="text-xs text-muted-foreground py-1">No tasks yet — add one below.</p>
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
          <div className="flex items-center gap-3 pt-1 border-t border-border/60">
            <Button onClick={save} disabled={!canSave} className="mt-4 gap-2">
              {saveStatus === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saveStatus === "saved"  && <Check   className="h-3.5 w-3.5" />}
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save plan"}
            </Button>
            {!hasPartnership && (
              <p className="mt-4 text-xs text-muted-foreground">Link a partner first</p>
            )}
            {saveStatus === "error" && (
              <p className="mt-4 text-xs text-destructive">Something went wrong. Try again.</p>
            )}
          </div>
        </div>
      )}
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
    <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={task.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Task name"
          className="h-9 flex-1 min-w-0"
        />
        <TypeToggle
          value={task.task_type}
          onChange={(type) => onChange({ task_type: type, target_value: task.target_value || 1 })}
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
              onChange({ target_value: Math.max(1, parseInt(e.target.value, 10) || 1) })
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
  partnership:       DbPartnership | null;
  pendingInviteCode: string | null;
  partnerProfile:    { display_name: string | null; email: string } | null;
}) {
  const [open,        setOpen]        = useState(false);
  const [inviteCode,  setInviteCode]  = useState<string | null>(pendingInviteCode);
  const [loadingCode, setLoadingCode] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [inputCode,   setInputCode]   = useState("");
  const [linking,     setLinking]     = useState(false);
  const [linkStatus,  setLinkStatus]  = useState<"idle" | "success" | "error">("idle");
  const [linkMessage, setLinkMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing,      setRemoving]      = useState(false);
  const [removeError,   setRemoveError]   = useState("");

  const partnerName =
    partnerProfile?.display_name?.trim() ||
    partnerProfile?.email?.split("@")[0] ||
    "Companion";

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
      setLinkMessage("Companion linked! Refresh to continue.");
    } else {
      setLinkStatus("error");
      setLinkMessage(json?.error ?? "Something went wrong.");
    }
    setLinking(false);
  }

  async function removePartner() {
    setRemoving(true);
    setRemoveError("");
    const res = await fetch("/api/partner/remove", { method: "POST" });
    if (res.ok) {
      window.location.reload();
    } else {
      setRemoveError("Something went wrong. Please try again.");
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/30"
      >
        <div>
          <p className="text-base font-semibold text-foreground">Companion</p>
          {!open && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {partnership?.status === "active" ? partnerName : "Tap to connect"}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border/60 p-5">
          {/* ── Active ──────────────────────────────────────────────── */}
          {partnership?.status === "active" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
                  {partnerName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{partnerName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <UserCheck className="h-3 w-3 text-primary" />
                    <p className="text-xs text-primary">Active</p>
                  </div>
                </div>
              </div>

              {/* ── Remove / confirm ──────────────────────────────── */}
              {!confirmRemove ? (
                <button
                  onClick={() => setConfirmRemove(true)}
                  className="flex items-center gap-2 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove companion
                </button>
              ) : (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                  <p className="text-sm font-semibold text-destructive">Remove companion?</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This will dissolve your partnership. All shared progress and history will be permanently lost and cannot be recovered.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={removePartner}
                      disabled={removing}
                      className="flex-1 gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {removing
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2  className="h-3.5 w-3.5" />}
                      {removing ? "Removing…" : "Yes, remove"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setConfirmRemove(false)}
                      disabled={removing}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                  {removeError && (
                    <p className="text-xs text-destructive">{removeError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── No active partnership ────────────────────────────────── */}
          {(!partnership || partnership.status !== "active") && (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Invite your companion</p>
                {!inviteCode ? (
                  <Button variant="outline" onClick={generateInvite} disabled={loadingCode} className="w-full">
                    {loadingCode && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Get an invite code
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-xl border border-border/60 bg-secondary px-4 py-2.5 text-center font-mono text-base font-semibold tracking-[0.25em] text-foreground select-all">
                      {inviteCode}
                    </div>
                    <button
                      onClick={copyCode}
                      aria-label="Copy invite code"
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">or enter a code</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Have a code?</p>
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
                  <Button onClick={linkPartner} disabled={linking || inputCode.trim().length < 6}>
                    {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Link"}
                  </Button>
                </div>
                {linkStatus !== "idle" && (
                  <p className={cn("text-xs", linkStatus === "success" ? "text-accent" : "text-destructive")}>
                    {linkMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

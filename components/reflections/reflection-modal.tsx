"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveReflection, fetchReflectionForTask } from "@/lib/reflections/client-api";

interface ReflectionModalProps {
  weekId:     string;
  weekStatus: "active" | "completed";
  taskId:     string;
  taskTitle:  string;
  onClose:    (taskId: string, hasContent: boolean) => void;
}

export function ReflectionModal({
  weekId,
  weekStatus,
  taskId,
  taskTitle,
  onClose,
}: ReflectionModalProps) {
  const isLocked = weekStatus === "completed";

  const [draft,      setDraft]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef    = useRef("");   // always-current saved value without stale closure

  // Load existing reflection
  useEffect(() => {
    let cancelled = false;
    fetchReflectionForTask(weekId, taskId).then((existing) => {
      if (cancelled) return;
      const text = existing ?? "";
      savedRef.current = text;
      setDraft(text);
      setLoading(false);
      if (!isLocked) setTimeout(() => textareaRef.current?.focus(), 80);
    });
    return () => { cancelled = true; };
  }, [weekId, taskId, isLocked]);

  const persistDraft = useCallback(async (text: string) => {
    if (isLocked || text.trim() === savedRef.current.trim() || text.trim() === "") return;
    setSaveStatus("saving");
    const { error } = await saveReflection(weekId, taskId, text);
    if (!error) {
      savedRef.current = text;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } else {
      setSaveStatus("idle");
    }
  }, [weekId, taskId, isLocked]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setDraft(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistDraft(text), 1400);
  };

  const handleClose = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isLocked && draft.trim() !== savedRef.current.trim() && draft.trim().length > 0) {
      await saveReflection(weekId, taskId, draft);
    }
    const hasContent = draft.trim().length > 0 || savedRef.current.trim().length > 0;
    onClose(taskId, hasContent);
  }, [isLocked, draft, weekId, taskId, onClose]);

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Reflection for ${taskTitle}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div className={cn(
        "relative z-10 mx-4 mb-4 w-full max-w-lg sm:mb-0",
        "flex flex-col overflow-hidden",
        "rounded-2xl border border-border/50 bg-card shadow-modal",
      )}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <PenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium text-foreground">
              {taskTitle}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3 pl-4">
            <span className={cn(
              "text-xs transition-opacity duration-300",
              saveStatus === "idle" ? "opacity-0" : "opacity-100",
              saveStatus === "saving" ? "text-muted-foreground" : "text-primary",
            )}>
              {saveStatus === "saving" ? "Saving…" : "Saved"}
            </span>

            {isLocked && (
              <span className="text-xs text-muted-foreground">Read only</span>
            )}

            <button
              onClick={handleClose}
              aria-label="Close reflection"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg",
                "text-muted-foreground transition-colors",
                "hover:bg-secondary hover:text-foreground",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Journal body */}
        <div className="relative min-h-52">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ) : (
            <>
              {/* Notebook lines */}
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    transparent,
                    transparent 31px,
                    var(--border) 31px,
                    var(--border) 32px
                  )`,
                  backgroundPositionY: "5px",
                  opacity: 0.6,
                }}
              />

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={handleChange}
                readOnly={isLocked}
                placeholder={isLocked ? "" : "Write your reflection here…"}
                rows={8}
                className={cn(
                  "relative z-10 w-full resize-none bg-transparent",
                  "px-5 py-3",
                  "text-2xl leading-8 text-foreground",
                  "placeholder:text-muted-foreground/40 placeholder:text-2xl",
                  "focus:outline-none",
                  isLocked ? "cursor-default select-text" : "cursor-text",
                )}
                style={{ fontFamily: "var(--font-caveat), cursive" }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

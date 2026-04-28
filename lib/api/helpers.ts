import { createClient } from "@/lib/supabase/server";
import { getActivePartnership } from "@/lib/week/queries";
import type { DbPartnership, DbUser } from "@/lib/types/database";

// ─── Response helpers ─────────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data, error: null }, { status });
}

export function err(message: string, status = 400): Response {
  return Response.json({ data: null, error: message }, { status });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

interface AuthResult {
  user:          DbUser | null;
  unauthorized:  Response | null;
}

export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, unauthorized: err("Unauthorized", 401) };
  }

  return {
    user: user as unknown as DbUser,
    unauthorized: null,
  };
}

// ─── Partnership guard ────────────────────────────────────────────────────────

interface PartnershipResult {
  partnership:      DbPartnership | null;
  partnershipError: Response | null;
}

export async function requirePartnership(
  userId: string
): Promise<PartnershipResult> {
  const partnership = await getActivePartnership(userId);

  if (!partnership) {
    return {
      partnership:      null,
      partnershipError: err("No active partnership", 404),
    };
  }

  return { partnership, partnershipError: null };
}

// ─── Task + progress lookup ───────────────────────────────────────────────────

interface TaskProgressResult {
  task:      { id: string; task_type: string; target_value: number | null; week_id: string } | null;
  progress:  { id: string; current_value: number } | null;
  fetchError: Response | null;
}

export async function getTaskAndProgress(
  taskId: string,
  userId: string
): Promise<TaskProgressResult> {
  const supabase = await createClient();

  const [{ data: task }, { data: progress }] = await Promise.all([
    supabase
      .from("weekly_tasks")
      .select("id, task_type, target_value, week_id")
      .eq("id", taskId)
      .maybeSingle(),
    supabase
      .from("task_progress")
      .select("id, current_value")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!task)     return { task: null, progress: null, fetchError: err("Task not found", 404) };
  if (!progress) return { task, progress: null, fetchError: err("Progress record not found", 404) };

  return { task, progress, fetchError: null };
}

// ─── Active week guard ────────────────────────────────────────────────────────

interface ActiveWeekResult {
  active:    boolean;
  weekError: Response | null;
}

export async function requireActiveWeek(weekId: string): Promise<ActiveWeekResult> {
  const supabase = await createClient();

  const { data: week } = await supabase
    .from("weeks")
    .select("status")
    .eq("id", weekId)
    .maybeSingle();

  if (!week || week.status !== "active") {
    return { active: false, weekError: err("Week is not active", 403) };
  }

  return { active: true, weekError: null };
}

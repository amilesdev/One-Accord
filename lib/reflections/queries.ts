import { createClient } from "@/lib/supabase/server";
import type { DbReflection } from "@/lib/types/database";

/**
 * Returns all reflections for a given week that belong to userId.
 * Reflections are private — never call this with a partner's userId.
 */
export async function getReflectionsForWeek(
  weekId: string,
  userId: string
): Promise<DbReflection[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reflections")
    .select("*")
    .eq("week_id", weekId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

/**
 * Returns the single reflection for a (user, week, task) combination,
 * or null if none exists yet.
 * Pass task_id=null for a week-level (non-task) reflection.
 */
export async function getReflectionForTask(
  weekId: string,
  userId: string,
  taskId: string | null
): Promise<DbReflection | null> {
  const supabase = await createClient();

  const query = supabase
    .from("reflections")
    .select("*")
    .eq("week_id", weekId)
    .eq("user_id", userId);

  const { data } = await (taskId
    ? query.eq("task_id", taskId)
    : query.is("task_id", null)
  ).maybeSingle();

  return data ?? null;
}

/**
 * Returns a single reflection by ID, only if it belongs to userId.
 */
export async function getReflectionById(
  reflectionId: string,
  userId: string
): Promise<DbReflection | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reflections")
    .select("*")
    .eq("id", reflectionId)
    .eq("user_id", userId)
    .maybeSingle();

  return data ?? null;
}

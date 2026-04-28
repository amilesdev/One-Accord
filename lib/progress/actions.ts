"use server";

import { createClient } from "@/lib/supabase/server";

export interface SaveResult {
  error: string | null;
}

/**
 * Persists a new current_value for a task_progress row.
 *
 * The client is responsible for computing the correct new value
 * (increment, decrement, toggle, undo). Two layers enforce correctness:
 *   1. Client-side: bounds checked before calling this action.
 *   2. DB trigger: enforce_task_progress_limits rejects any out-of-range
 *      value and returns a PostgreSQL exception, which surfaces as error here.
 *
 * RLS ensures only the row's owner can call this.
 */
export async function saveProgressValue(
  progressId: string,
  newValue: number
): Promise<SaveResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_progress")
    .update({ current_value: newValue })
    .eq("id", progressId);

  return { error: error ? error.message : null };
}

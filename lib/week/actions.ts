"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getActivePartnership,
  getActiveTemplate,
  getActiveWeek,
} from "@/lib/week/queries";
import { getWeekBounds, isWeekExpired } from "@/lib/week/utils";
import type { DbWeek } from "@/lib/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeekResult =
  | { status: "ok";          week: DbWeek }
  | { status: "no_partnership" }
  | { status: "no_template" }
  | { status: "error";       message: string };

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Calls the SECURITY DEFINER PostgreSQL function that atomically:
 *   - locks the previous active week
 *   - creates the new week
 *   - copies tasks from the template
 *   - initialises task_progress rows for BOTH users
 */
async function createWeek(
  partnershipId: string,
  templateId:   string,
  startDate:    string,
  endDate:      string
): Promise<DbWeek> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_week_for_partnership", {
    p_partnership_id: partnershipId,
    p_template_id:    templateId,
    p_start_date:     startDate,
    p_end_date:       endDate,
  });

  if (error) throw new Error(error.message);
  return data as DbWeek;
}

// ─── Public Actions ───────────────────────────────────────────────────────────

/**
 * Called on every main-screen load.
 *
 * Logic:
 *   1. Get the authenticated user.
 *   2. Get their active partnership. → no_partnership if none.
 *   3. Get the active week.
 *      a. If it exists and is NOT expired → return it as-is.
 *      b. If it exists and IS expired → roll it over.
 *      c. If it doesn't exist → create the first week.
 *   4. Steps b/c require an active template. → no_template if none.
 */
export async function ensureActiveWeek(): Promise<WeekResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "error", message: "Not authenticated" };

  try {
    // 1. Partnership
    const partnership = await getActivePartnership(user.id);
    if (!partnership) return { status: "no_partnership" };

    // 2. Current active week
    const activeWeek = await getActiveWeek(partnership.id);

    if (activeWeek && !isWeekExpired(activeWeek.end_date)) {
      // Still valid — nothing to do
      return { status: "ok", week: activeWeek };
    }

    // Week is expired or doesn't exist — need to create a new one
    const template = await getActiveTemplate(partnership.id);
    if (!template) return { status: "no_template" };

    if (template.task_definitions.length === 0) {
      return { status: "no_template" };
    }

    const { startDate, endDate } = getWeekBounds(template.week_start_day);

    const newWeek = await createWeek(
      partnership.id,
      template.id,
      startDate,
      endDate
    );

    return { status: "ok", week: newWeek };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { status: "error", message };
  }
}

/**
 * Explicitly triggers a rollover for the current user's partnership.
 * Useful if a user opens the app after a week boundary has passed
 * and the automatic check via ensureActiveWeek hasn't run yet.
 *
 * Returns the same WeekResult shape as ensureActiveWeek.
 */
export async function rolloverWeek(): Promise<WeekResult> {
  // ensureActiveWeek already handles all rollover logic
  return ensureActiveWeek();
}

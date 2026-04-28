/**
 * Returns the ISO date string (YYYY-MM-DD) for a given Date.
 * Uses UTC to stay consistent with PostgreSQL DATE columns.
 */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Calculates the start and end dates of the week that contains `today`,
 * given a configured week-start day (0 = Sunday … 6 = Saturday).
 *
 * Both dates are inclusive. A week is always exactly 7 days.
 */
export function getWeekBounds(
  weekStartDay: number,
  today: Date = new Date()
): { startDate: string; endDate: string } {
  const utcToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  const currentDay = utcToday.getUTCDay(); // 0 = Sunday
  const daysBack   = (currentDay - weekStartDay + 7) % 7;

  const start = new Date(utcToday);
  start.setUTCDate(utcToday.getUTCDate() - daysBack);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return { startDate: toISODate(start), endDate: toISODate(end) };
}

/**
 * Returns true if the week's end_date is strictly before today (UTC).
 * Used to decide whether a rollover is needed.
 */
export function isWeekExpired(endDate: string): boolean {
  const today = new Date();
  const utcToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const end = new Date(endDate).getTime(); // DATE string → midnight UTC
  return utcToday > end;
}

/**
 * Human-readable label for a week, e.g. "Apr 28 – May 4".
 */
export function formatWeekRange(startDate: string, endDate: string): string {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day:   "numeric",
      timeZone: "UTC",
    });
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

/**
 * Returns the completion percentage (0–100) for a list of progress values.
 */
export function calcCompletionPercent(
  tasks: Array<{ task_type: string; target_value: number | null; current_value: number }>
): number {
  if (tasks.length === 0) return 0;

  const completed = tasks.filter((t) => {
    if (t.task_type === "counter")
      return t.target_value !== null && t.current_value >= t.target_value;
    return t.current_value === 1;
  }).length;

  return Math.round((completed / tasks.length) * 100);
}

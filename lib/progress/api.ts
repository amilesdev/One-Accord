/**
 * Typed wrappers around the task progress REST API.
 * All functions return { error: string | null }.
 * The caller handles optimistic state; these only persist.
 */

type ApiResult = { error: string | null };

async function post(url: string, body?: object): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body:    body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { error: json.error ?? null };
  } catch {
    return { error: "Network error" };
  }
}

/** Increment a counter task by 1. */
export function apiIncrement(taskId: string): Promise<ApiResult> {
  return post(`/api/tasks/${taskId}/increment`);
}

/**
 * Toggle a simple task's completion state.
 * Passing `completed` explicitly avoids a race condition where a
 * toggle in-flight and a second tap could cancel each other out.
 */
export function apiComplete(taskId: string, completed: boolean): Promise<ApiResult> {
  return post(`/api/tasks/${taskId}/complete`, { completed });
}

/**
 * Restore a task to a specific value.
 * Used for both counter decrement (−1) and undo (previous value).
 */
export function apiSetValue(taskId: string, value: number): Promise<ApiResult> {
  return post(`/api/tasks/${taskId}/undo`, { value });
}

export async function saveReflection(
  weekId: string,
  taskId: string,
  content: string
): Promise<{ error: string | null }> {
  const res = await fetch("/api/reflections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ week_id: weekId, task_id: taskId, content }),
  });
  const json = await res.json();
  return { error: json.error };
}

export async function fetchReflectionForTask(
  weekId: string,
  taskId: string
): Promise<string | null> {
  const params = new URLSearchParams({ week_id: weekId, task_id: taskId });
  const res = await fetch(`/api/reflections?${params}`);
  const json = await res.json();
  if (json.error || !json.data) return null;
  return json.data.reflection?.content ?? null;
}

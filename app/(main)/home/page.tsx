import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">This Week</h1>
        <p className="text-sm text-muted-foreground">Your personal tasks and progress.</p>
      </header>

      <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        <p className="text-sm">Tasks coming soon.</p>
      </div>
    </div>
  );
}

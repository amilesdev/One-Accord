import { BottomNav } from "@/components/navigation/bottom-nav";
import { ensureActiveWeek } from "@/lib/week/actions";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Runs on every server render. Silently rolls over an expired week or
  // creates the first week if one doesn't exist yet. Pages read the
  // resulting active week via their own queries — no prop drilling needed.
  await ensureActiveWeek();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}

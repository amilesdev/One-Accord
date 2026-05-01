"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/home",      label: "Home",      icon: Home },
  { href: "/companion", label: "Companion",  icon: Users },
  { href: "/summary",   label: "Summary",   icon: BookOpen },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/90 backdrop-blur-xl safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-xl px-5 py-2 text-xs font-medium transition-all duration-200",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute inset-0 rounded-xl bg-primary/10" />
              )}
              <Icon
                className={cn(
                  "relative h-5 w-5 transition-all duration-200",
                  active ? "stroke-[2.25]" : "stroke-[1.5]"
                )}
              />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

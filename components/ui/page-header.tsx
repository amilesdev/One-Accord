import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, className, action }: PageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground leading-snug">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-1.5">{action}</div>}
    </header>
  );
}

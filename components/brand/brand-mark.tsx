import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  size?: number;
}

export function BrandMark({ className, size = 40 }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      aria-hidden="true"
    >
      {/* Vertical bar */}
      <rect x="17" y="4" width="6" height="32" rx="3" fill="currentColor" opacity="0.9" />
      {/* Horizontal bar — sits at the upper third like a true cross */}
      <rect x="4" y="12" width="32" height="6" rx="3" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

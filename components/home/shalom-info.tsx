"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function ShalomInfo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Learn about Shalom"
        className="absolute bottom-full -right-1 -mb-3.5 flex h-3.5 w-3.5 items-center justify-center text-primary"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-full w-full"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        >
          <circle cx="7.5" cy="7.5" r="5" />
          <line x1="11.5" y1="11.5" x2="16.5" y2="16.5" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Card */}
          <div
            className="relative w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-modal space-y-4"
            style={{ animation: "shalom-in 220ms cubic-bezier(0.16,1,0.3,1) both" }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Title */}
            <div className="space-y-0.5 pr-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Shalom{" "}
                <span className="text-primary font-semibold">(שָׁלוֹם)</span>
              </h2>
            </div>

            {/* Body */}
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                <em className="text-foreground not-italic font-medium">Shalom</em>{" "}is a Hebrew word often translated as &ldquo;peace&rdquo; and is commonly used as both a greeting and a blessing in Jewish and Christian communities.
              </p>
              <p>
                <span className="font-semibold text-foreground">Yahweh-Shalom</span>,{" "}
                <em>&ldquo;The Lord is Peace&rdquo;</em>{" "}(Judges 6:24), is one of the names of God, revealing His nature as the source of true peace. In the same manner,{" "}
                <em>&ldquo;Prince of Peace&rdquo;</em>{" "}(Isaiah 9:6) is a title given to the Messiah, pointing to the One who brings lasting peace to humanity.
              </p>
              <p>At its heart, Shalom is a declaration:</p>
            </div>

            {/* Declaration */}
            <p className="text-base font-semibold text-primary text-center pt-1">
              May the God of peace be with you.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shalom-in {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
      `}</style>
    </>
  );
}

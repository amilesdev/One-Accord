"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  /** How often to re-fetch server data, in ms. Default: 5000. */
  intervalMs?: number;
}

/**
 * Invisible client component that calls router.refresh() on a timer.
 * router.refresh() re-runs the nearest server component and streams down
 * fresh props — no full page reload, no visible flash.
 *
 * Pauses automatically when the tab is hidden to avoid wasted requests.
 */
export function AutoRefresh({ intervalMs = 5000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const id = setInterval(refresh, intervalMs);

    // Also refresh immediately when the tab comes back into focus
    document.addEventListener("visibilitychange", refresh);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);

  return null;
}

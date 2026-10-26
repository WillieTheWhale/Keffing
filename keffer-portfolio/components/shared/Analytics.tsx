"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageview } from "@/lib/analytics";

/** Reports each page view, the first load and every client-side navigation (lib/analytics.ts). */
export default function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    trackPageview(pathname || "/");
  }, [pathname]);
  return null;
}

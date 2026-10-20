"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Keeps list filters in the URL (shareable, back button works). Text search is debounced. */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    params,
    query,
    setQuery: (q: string) => {
      setQuery(q);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => set({ q: q || null }), 250);
    },
    set,
    clear: () => {
      setQuery("");
      router.replace(pathname, { scroll: false });
    },
  };
}

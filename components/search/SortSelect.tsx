"use client";

import { useRouter } from "next/navigation";
import { SORT_OPTIONS, facetsToHref, setFacet, type Facets, type SortKey } from "@/lib/search";

/**
 * Sort navigates rather than filtering in place, keeping sort in the URL
 * alongside every other refinement so a sorted, filtered view is shareable.
 */
export function SortSelect({ facets }: { facets: Facets }) {
  const router = useRouter();

  return (
    <label className="flex shrink-0 items-center gap-2 text-[13px] text-ink">
      <span className="hidden sm:inline">Sort by:</span>
      <span className="relative">
        <select
          value={facets.sort}
          onChange={(e) => router.push(facetsToHref(setFacet(facets, "sort", e.target.value as SortKey)))}
          aria-label="Sort results by"
          className="h-[33px] cursor-pointer appearance-none rounded-[8px] border border-[#888c8c] bg-gradient-to-b from-white to-[#e7e9ec] pl-3 pr-8 text-[13px] font-bold text-ink hover:from-[#f7f8fa] hover:to-[#dcdfe3] focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink" aria-hidden>
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    </label>
  );
}

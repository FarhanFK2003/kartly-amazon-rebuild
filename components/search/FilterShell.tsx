"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Houses the filter rail in one DOM instance that is a static left rail on
 * desktop and a slide-in drawer on mobile.
 *
 * Rendering the rail twice behind media queries would duplicate every filter
 * link and its aria-pressed state in the accessibility tree, so instead the
 * same element is repositioned by CSS. That also means no JavaScript media
 * query, and therefore no hydration mismatch.
 */
export function FilterShell({
  children,
  activeCount,
  resultCount,
}: {
  children: React.ReactNode;
  activeCount: number;
  resultCount: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-white px-4 text-[13px] font-bold text-ink shadow-[0_2px_5px_rgba(213,217,217,.5)] lg:hidden"
        aria-expanded={open}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-[#007185] px-[6px] text-[11px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* scrim, mobile only */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/60 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <aside
        aria-label="Filters"
        className={cn(
          // mobile: drawer
          // Visibility is part of the transition on purpose. A panel parked
          // off-canvas with a transform is still in the tab order and still in
          // the accessibility tree, so on a phone a keyboard or screen-reader
          // user walking the toolbar falls into a rail of filters they cannot
          // see. visibility:hidden removes it; because visibility interpolates
          // discretely at the end of a transition, the panel still slides out
          // before it disappears. Doing it in CSS keeps this one instance
          // serving both the mobile drawer and the desktop rail.
          "fixed inset-y-0 left-0 z-[61] flex w-[86vw] max-w-[340px] flex-col bg-white transition-[transform,visibility] duration-200 ease-out",
          open ? "visible translate-x-0" : "invisible -translate-x-full",
          // desktop: static rail
          "lg:visible lg:static lg:z-auto lg:w-[240px] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:bg-transparent lg:transition-none"
        )}
      >
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-4 lg:hidden">
          <span className="text-[17px] font-bold text-ink">
            Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="p-1">
            <X className="h-6 w-6 text-ink" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 lg:overflow-visible lg:px-0">
          {children}
        </div>

        <div className="shrink-0 border-t border-line p-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-10 w-full rounded-full border border-cta-border bg-cta text-[14px] font-medium text-ink"
          >
            Show {resultCount} {resultCount === 1 ? "result" : "results"}
          </button>
        </div>
      </aside>
    </>
  );
}

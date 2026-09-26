"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { SORT_OPTIONS, facetsToHref, setFacet, type Facets } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";

/**
 * Sort, as a menu of links.
 *
 * It was a native <select> driving router.push on change, which meant the
 * current order was only legible by reading the collapsed control, and a
 * keyboard user changing it navigated on every arrow key. Each option is now a
 * real link to the sorted URL: the label states the current order in full,
 * middle-click and back both behave, and it still works with JavaScript off,
 * because with no JavaScript the summary is simply a list of sorted views.
 *
 * Sort stays in the querystring alongside every other refinement, so a sorted,
 * filtered, paginated view remains one shareable address.
 */
export function SortControl({ facets }: { facets: Facets }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => setOpen(false), [pathname, params]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.value === facets.sort) ?? SORT_OPTIONS[0];

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        data-testid={TID.sortControl}
        className={cn(
          "flex h-9 items-center gap-2 rounded-[var(--radius-btn)] border border-line-strong bg-surface px-3",
          "text-body text-ink transition-colors hover:bg-surface-sunk",
          open && "bg-surface-sunk"
        )}
      >
        <ArrowUpDown className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
        <span className="hidden text-ink-2 sm:inline">Sort:</span>
        <span className="font-medium">{current.label}</span>
        <ChevronDown className={cn("h-4 w-4 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Sort results by"
          className="absolute right-0 top-[calc(100%+6px)] z-[65] w-[240px] overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-[var(--shadow-overlay)]"
        >
          {SORT_OPTIONS.map((o) => {
            const selected = o.value === facets.sort;
            return (
              <Link
                key={o.value}
                role="menuitem"
                href={facetsToHref(setFacet(facets, "sort", o.value))}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-body transition-colors hover:bg-surface-sunk",
                  selected ? "font-medium text-ink" : "text-ink-2"
                )}
              >
                <Check className={cn("h-4 w-4 shrink-0 text-brand", !selected && "invisible")} aria-hidden />
                {o.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

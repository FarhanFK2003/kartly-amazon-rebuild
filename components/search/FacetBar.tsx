"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FacetModel, Facets } from "@/lib/search";
import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { FacetGroup, FACET_LABELS, facetHasOptions, type FacetKey } from "@/components/search/FacetGroup";

/** The facets that get their own dropdown on desktop. The rest live in the sheet. */
const BAR_GROUPS: FacetKey[] = ["categories", "brands", "prices", "rating"];

/**
 * Filters across the top rather than down the left.
 *
 * The replica spent a 240px column of every listing page on a filter rail that
 * most visits never touch, permanently narrowing the results it was there to
 * refine. Kartly puts the same facets in a row of dropdowns above the grid, so
 * the full width belongs to product and the filters are still one click away.
 *
 * These are dropdowns of links, not menus of state. Everything inside comes
 * from FacetGroup, which is also what the sheet renders, so the desktop and
 * mobile filter sets are the same component and cannot diverge.
 */
export function FacetBar({ facets, model }: { facets: Facets; model: FacetModel }) {
  const groups = BAR_GROUPS.filter((g) => facetHasOptions(model, g));
  if (groups.length === 0) return null;

  return (
    <div data-testid={TID.facetBar} className="hidden items-center gap-2 lg:flex">
      {groups.map((g) => (
        <FacetDropdown key={g} facets={facets} model={model} group={g} />
      ))}
    </div>
  );
}

function FacetDropdown({
  facets,
  model,
  group,
}: {
  facets: Facets;
  model: FacetModel;
  group: FacetKey;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

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

  const selected = countSelected(facets, group);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={TID.facetChip}
        className={cn(
          "flex h-9 items-center gap-[6px] rounded-[var(--radius-btn)] border px-3 text-body transition-colors",
          selected > 0
            ? "border-brand bg-brand-tint font-medium text-brand"
            : "border-line-strong bg-surface text-ink hover:bg-surface-sunk",
          open && selected === 0 && "bg-surface-sunk"
        )}
      >
        {FACET_LABELS[group]}
        {selected > 0 && (
          <span className="tnum rounded-full bg-brand px-[6px] text-label font-semibold leading-[18px] text-white">
            {selected}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-[calc(100%+6px)] z-[65] max-h-[min(60vh,420px)] w-[280px] overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border border-line bg-surface p-2 shadow-[var(--shadow-overlay)]"
        >
          <FacetGroup facets={facets} model={model} group={group} />
        </div>
      )}
    </div>
  );
}

function countSelected(facets: Facets, group: FacetKey): number {
  if (group === "categories") return facets.categories.length;
  if (group === "brands") return facets.brands.length;
  if (group === "prices") return facets.prices.length;
  if (group === "rating") return facets.rating ? 1 : 0;
  if (group === "deals") return facets.dealsOnly ? 1 : 0;
  return facets.inStockOnly ? 1 : 0;
}

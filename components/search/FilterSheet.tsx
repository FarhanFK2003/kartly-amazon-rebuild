"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { clearedFacets, facetsToHref, type FacetModel, type Facets } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { FacetGroup, FACET_LABELS, facetHasOptions, type FacetKey } from "@/components/search/FacetGroup";

const GROUPS: FacetKey[] = ["categories", "brands", "prices", "rating", "deals", "availability"];

/**
 * The complete facet set in a slide-over.
 *
 * One sheet serves every width. On a phone it is the only way to filter; on a
 * desktop it is the "all filters" companion to the per-facet popovers in the
 * bar. The replica had a left rail for desktop and a separate drawer for
 * mobile, which meant two arrangements of the same links and two chances for
 * them to disagree.
 *
 * Modal while open, because it covers the results it filters: focus moves in,
 * Tab is cycled, Escape closes, the page behind does not scroll, and focus
 * returns to the trigger. Every control inside is still a link, so applying a
 * filter navigates and the sheet closes with the page change.
 */
export function FilterSheet({
  facets,
  model,
  activeCount,
  resultCount,
  className,
}: {
  facets: Facets;
  model: FacetModel;
  activeCount: number;
  resultCount: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Portals need document, which only exists after mount.
  useEffect(() => setMounted(true), []);

  const pathname = usePathname();
  const params = useSearchParams();

  // Applying a filter navigates; the sheet should not survive that.
  useEffect(() => setOpen(false), [pathname, params]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(
      () => panelRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus(),
      60
    );

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={TID.filterSheet}
        data-testid={TID.filterSheetTrigger}
        className={cn(
          "flex h-9 items-center gap-2 rounded-[var(--radius-btn)] border border-line-strong bg-surface px-3",
          "text-body font-medium text-ink transition-colors hover:bg-surface-sunk",
          activeCount > 0 && "border-brand bg-brand-tint text-brand",
          className
        )}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="tnum rounded-full bg-brand px-[6px] text-label font-semibold leading-[18px] text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/*
        Portalled to <body> on purpose.

        The sheet is rendered from inside the sticky control bar, which carries
        a backdrop-filter. A filtered element becomes the containing block for
        its fixed-position descendants, so without this the panel anchors to the
        bar rather than the viewport and collapses to a strip a few hundred
        pixels tall. Same trap as a transformed ancestor.
      */}
      {mounted && createPortal(
        <>
      <div
        className={cn(
          "fixed inset-0 z-[75] bg-ink/45 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <div
        id={TID.filterSheet}
        ref={panelRef}
        data-testid={TID.filterSheet}
        role="dialog"
        aria-modal={open || undefined}
        aria-label="Filters"
        aria-hidden={!open || undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-[76] flex w-[92vw] max-w-[380px] flex-col bg-surface",
          "shadow-[var(--shadow-panel)] transition-[transform,visibility] duration-200 ease-out",
          open ? "visible translate-x-0" : "invisible translate-x-full"
        )}
      >
        <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-line px-4">
          <h2 className="font-display text-display-sm font-medium text-ink">Filters</h2>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            aria-label="Close filters"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-ink-2 transition-colors hover:bg-surface-sunk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          {GROUPS.filter((g) => facetHasOptions(model, g)).map((g) => (
            <section key={g} className="border-b border-line py-3 last:border-b-0">
              <h3 className="px-2 pb-1 text-label font-semibold uppercase tracking-wide text-ink-3">
                {FACET_LABELS[g]}
              </h3>
              <FacetGroup facets={facets} model={model} group={g} />
            </section>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-line p-3">
          {activeCount > 0 && (
            <Link
              href={facetsToHref(clearedFacets(facets))}
              className="flex h-10 flex-1 items-center justify-center rounded-[var(--radius-btn)] border border-line-strong bg-surface text-body font-medium text-ink transition-colors hover:bg-surface-sunk"
            >
              Clear all
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className="tnum h-10 flex-1 rounded-[var(--radius-btn)] bg-brand text-body font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Show {resultCount} {resultCount === 1 ? "result" : "results"}
          </button>
        </div>
      </div>
        </>,
        document.body
      )}
    </>
  );
}

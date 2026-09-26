"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";
import type { NavDepartment, NavGroup } from "@/lib/navigation";

/**
 * Departments, on demand.
 *
 * This replaces a 380px full-height modal drawer and a permanent department
 * row in the header. Both were spending standing chrome on navigation that a
 * shopper uses once a session. A popover costs nothing until it is opened, and
 * everything in it is a real link, so it works from the keyboard, opens in a
 * new tab, and is crawlable.
 *
 * Not a dialog: it does not trap focus or block the page, because it is a menu
 * of links rather than a task. Escape, an outside click and navigation all
 * dismiss it, and focus returns to the trigger.
 */
export function BrowsePopover({
  departments,
  groups,
}: {
  departments: NavDepartment[];
  groups: NavGroup[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={TID.browseTrigger}
        className={cn(
          "flex h-9 items-center gap-1 rounded-[var(--radius-sm)] px-3 text-body font-medium",
          "transition-colors hover:bg-surface-sunk",
          open ? "bg-surface-sunk text-ink" : "text-ink"
        )}
      >
        Browse
        <ChevronDown className={cn("h-4 w-4 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          data-testid={TID.browsePopover}
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-[70] w-[min(92vw,640px)] overflow-hidden",
            "rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-overlay)]"
          )}
        >
          <div className="grid grid-cols-1 gap-x-6 p-4 sm:grid-cols-[1.4fr_1fr]">
            <nav aria-label="Departments">
              <h2 className="px-2 pb-1 text-label font-semibold uppercase tracking-wide text-ink-3">
                Departments
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2">
                {departments.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/s?i=${d.id}`}
                      className="flex items-baseline justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-[6px] text-body text-ink transition-colors hover:bg-surface-sunk"
                    >
                      <span className="min-w-0 truncate">{d.name}</span>
                      <span className="tnum shrink-0 text-body-sm text-ink-3">{d.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-4 border-t border-line pt-4 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              {groups.map((g) => (
                <nav key={g.title} aria-label={g.title} className="mb-3 last:mb-0">
                  <h2 className="px-2 pb-1 text-label font-semibold uppercase tracking-wide text-ink-3">
                    {g.title}
                  </h2>
                  <ul>
                    {g.links.map((l) => (
                      <li key={l.href + l.label}>
                        <Link
                          href={l.href}
                          className="block rounded-[var(--radius-sm)] px-2 py-[6px] text-body text-ink transition-colors hover:bg-surface-sunk"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          <div className="border-t border-line bg-surface-sunk px-4 py-3">
            <Link
              href="/browse"
              className="inline-flex items-center gap-1 text-body font-medium text-brand-ink hover:underline"
            >
              All departments
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

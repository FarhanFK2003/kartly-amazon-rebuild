"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe, Check } from "lucide-react";
import { cn, CURRENCY } from "@/lib/utils";
import { HEADER_HOVER_BOX } from "@/components/chrome/styles";

/**
 * Language and currency.
 *
 * This was a button with a chevron and no menu behind it - the only control in
 * the header that looked interactive and did nothing. It now opens a real
 * popover built on the same pattern as the account menu: aria-expanded,
 * role="menu", outside click, Escape, and close on navigation.
 *
 * What it does not do is offer languages or currencies that are not there.
 * Kartly prices everything in one currency and ships one locale, so the menu
 * states that plainly instead of presenting a switcher that silently does
 * nothing - a dropdown that changes no prices is worse than no dropdown.
 */
export function LocaleMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative" data-testid="locale-menu">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(HEADER_HOVER_BOX, "flex items-center gap-1 text-[14px] font-bold")}
      >
        {/* A globe rather than a flag emoji: Windows ships no glyph for
            regional-indicator pairs, so a flag renders as bare letters. */}
        <Globe className="h-4 w-4 text-[#ccc]" strokeWidth={2} />
        EN
        <ChevronDown className={cn("h-3 w-3 text-[#ccc] transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Language and currency"
          className="absolute right-0 top-[calc(100%+6px)] z-[70] w-[250px] overflow-hidden rounded-[8px] border border-line bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,.25)]"
        >
          <p className="px-4 pb-1 pt-2 text-[12px] font-bold uppercase tracking-wide text-muted">
            Language
          </p>
          <Row label="English - EN" selected />

          <div className="mt-1 border-t border-line-soft" />

          <p className="px-4 pb-1 pt-2 text-[12px] font-bold uppercase tracking-wide text-muted">
            Currency
          </p>
          <Row label={`${CURRENCY.symbol} ${CURRENCY.code} - ${CURRENCY.label}`} selected />

          <div className="mt-1 border-t border-line-soft" />
          <p className="px-4 py-2 text-[12px] leading-[17px] text-muted">
            Kartly is a demo storefront with a single locale. Every price is shown in{" "}
            {CURRENCY.code} and nothing is converted.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, selected }: { label: string; selected?: boolean }) {
  return (
    <p
      role="menuitem"
      aria-current={selected || undefined}
      className="flex items-center gap-2 px-4 py-[6px] text-[14px] text-ink"
    >
      <Check className={cn("h-4 w-4 text-link", !selected && "invisible")} strokeWidth={2.5} />
      {label}
    </p>
  );
}

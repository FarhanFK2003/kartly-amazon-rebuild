"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { useSearchOverlay } from "@/lib/store/searchOverlay";

/**
 * Opens the search overlay.
 *
 * It renders as a link to /s, not a button, and only takes over the click once
 * JavaScript has mounted. That is what keeps search usable before hydration and
 * with scripting disabled: the trigger is a real navigation to a page that
 * carries a real search form. A <button> here would be a dead control on a page
 * that had not hydrated yet - which this project has shipped once before.
 *
 * Also bound to the two shortcuts people actually try: Cmd/Ctrl-K and "/".
 */
export function SearchTrigger({
  variant = "bar",
  className,
}: {
  /** "bar" is the wide desktop field; "icon" is the compact mobile control. */
  variant?: "bar" | "icon";
  className?: string;
}) {
  const open = useSearchOverlay((s) => s.open);
  const openSearch = useSearchOverlay((s) => s.openSearch);
  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);

      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openSearch();
        return;
      }
      // "/" is a search shortcut everywhere except inside a field.
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch]);

  const handle = (e: React.MouseEvent) => {
    if (!mounted) return; // let the link navigate
    e.preventDefault();
    openSearch();
  };

  if (variant === "icon") {
    return (
      <Link
        href="/s"
        onClick={handle}
        aria-label="Search products"
        aria-expanded={mounted ? open : undefined}
        aria-controls={mounted ? TID.searchOverlay : undefined}
        data-testid={TID.searchTrigger}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-ink",
          "transition-colors hover:bg-surface-sunk",
          className
        )}
      >
        <Search className="h-5 w-5" strokeWidth={2} />
      </Link>
    );
  }

  return (
    <Link
      href="/s"
      onClick={handle}
      aria-label="Search products"
      aria-expanded={mounted ? open : undefined}
      aria-controls={mounted ? TID.searchOverlay : undefined}
      data-testid={TID.searchTrigger}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-surface-sunk px-3",
        "text-body text-ink-3 transition-colors hover:border-line-strong hover:bg-surface",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-ink-2" strokeWidth={2} aria-hidden />
      <span className="flex-1 text-left">Search products</span>
      {/* The hint renders only after mount, because it is only true then. */}
      {mounted && (
        <kbd className="hidden shrink-0 rounded-[4px] border border-line bg-surface px-[5px] py-[1px] text-label font-medium text-ink-3 lg:block">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      )}
    </Link>
  );
}

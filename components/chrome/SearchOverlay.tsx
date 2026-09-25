"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Search, X, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { useSearchOverlay } from "@/lib/store/searchOverlay";
import type { Category } from "@/lib/types";
import type { Suggestion } from "@/lib/suggest";

const RECENT_KEY = "kartly.recentSearches";
const RECENT_MAX = 6;

/**
 * Full-screen search.
 *
 * Replaces the permanent header input. Search is the single most used control
 * in a marketplace and the least deserving of 700px of permanent chrome on
 * every page, so it collapses to a trigger and expands to a surface with room
 * to actually show results - suggestions, departments and products with their
 * prices, rather than a 15px dropdown row.
 *
 * Progressive enhancement is structural, not decorative. The overlay wraps a
 * real <form action="/s" method="get">, so submitting works whether or not the
 * JavaScript handler runs, and the trigger that opens this is an <a href="/s">
 * that only becomes an opener once mounted. Search has to keep working before
 * hydration; this project regressed exactly that once already.
 *
 * Keeps the WAI-ARIA combobox pattern from the header field it replaces: the
 * input owns aria-expanded, aria-controls and aria-activedescendant while the
 * listbox owns the options, so the highlighted suggestion is announced without
 * focus ever leaving the field.
 */
export function SearchOverlay({ categories }: { categories: Category[] }) {
  const open = useSearchOverlay((s) => s.open);
  const close = useSearchOverlay((s) => s.closeSearch);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const listboxId = useId();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  /* ---------- recent searches (viewer preference, not product data) -------- */

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      setRecent(raw ? (JSON.parse(raw) as string[]).slice(0, RECENT_MAX) : []);
    } catch {
      setRecent([]);
    }
  }, [open]);

  const remember = useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const prev = raw ? (JSON.parse(raw) as string[]) : [];
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* private mode or blocked storage: history is a convenience, not a feature */
    }
  }, []);

  /* ---------- open / close ------------------------------------------------ */

  useEffect(() => {
    if (!open) {
      setActive(-1);
      return;
    }

    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
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
      // Focus returns to whatever opened it.
      restoreRef.current?.focus?.();
    };
  }, [open, close]);

  /* ---------- suggestions: the existing endpoint, unchanged --------------- */

  const cache = useRef(new Map<string, Suggestion[]>());
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) {
      setSuggestions([]);
      return;
    }

    const cached = cache.current.get(term.toLowerCase());
    if (cached) {
      setSuggestions(cached);
      return;
    }

    const timer = window.setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        cache.current.set(term.toLowerCase(), data.suggestions);
        setSuggestions(data.suggestions);
      } catch {
        // Aborted or offline: keep what is on screen rather than blanking it.
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [query]);

  /* ---------- navigation -------------------------------------------------- */

  const go = useCallback(
    (href: string, remembered?: string) => {
      if (remembered) remember(remembered);
      close();
      router.push(href);
    },
    [close, remember, router]
  );

  function searchFor(term: string, scopeId?: string) {
    const search = new URLSearchParams();
    if (term.trim()) search.set("q", term.trim());
    if (scopeId) search.set("i", scopeId);
    go(`/s${search.toString() ? `?${search}` : ""}`, term);
  }

  function applySuggestion(s: Suggestion) {
    if (s.type === "product") return go(`/dp/${s.slug}`, query);
    if (s.type === "category") return go(`/s?i=${s.id}`);
    searchFor(s.text, s.scopeId);
  }

  function submit(e: React.FormEvent) {
    // Enhancement only: without JS the form GETs /s by itself.
    e.preventDefault();
    if (active >= 0 && suggestions[active]) {
      applySuggestion(suggestions[active]);
      return;
    }
    searchFor(query);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(suggestions.length - 1);
    }
  }

  const showList = suggestions.length > 0;

  return (
    <div
      id={TID.searchOverlay}
      data-testid={TID.searchOverlay}
      role="dialog"
      aria-modal={open || undefined}
      aria-label="Search products"
      aria-hidden={!open || undefined}
      className={cn(
        "fixed inset-0 z-[80] transition-opacity duration-150",
        open ? "visible opacity-100" : "invisible opacity-0"
      )}
    >
      <div className="absolute inset-0 bg-ink/45" onClick={close} aria-hidden />

      <div
        ref={panelRef}
        className={cn(
          "absolute inset-x-0 top-0 mx-auto flex max-h-full w-full max-w-[860px] flex-col",
          "bg-surface shadow-[var(--shadow-overlay)] transition-transform duration-150 ease-out",
          "sm:mt-[6vh] sm:rounded-[var(--radius-lg)]",
          open ? "translate-y-0" : "-translate-y-2"
        )}
      >
        {/* A real GET form: this is what makes search work without JavaScript. */}
        <form
          action="/s"
          method="get"
          role="search"
          onSubmit={submit}
          className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3"
        >
          <Search className="h-5 w-5 shrink-0 text-ink-3" strokeWidth={2} aria-hidden />
          <label htmlFor={`${listboxId}-input`} className="sr-only">
            Search Kartly
          </label>
          <input
            ref={inputRef}
            id={`${listboxId}-input`}
            name="q"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search products, brands and departments"
            autoComplete="off"
            data-testid={TID.searchInput}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listboxId}-opt-${active}` : undefined}
            className="min-w-0 flex-1 bg-transparent text-body-lg text-ink placeholder:text-ink-3 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-ink-2 transition-colors hover:bg-surface-sunk"
          >
            <X className="h-5 w-5" />
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {showList ? (
            <ul id={listboxId} role="listbox" aria-label="Search suggestions" className="flex flex-col">
              {suggestions.map((s, i) => (
                <li
                  key={`${s.type}-${s.type === "product" ? s.slug : s.text}`}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  // pointerdown fires before the input blurs, so the click lands
                  onPointerDown={(e) => {
                    e.preventDefault();
                    applySuggestion(s);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-body",
                    i === active ? "bg-brand-tint" : "bg-transparent"
                  )}
                >
                  {s.type === "product" ? (
                    <>
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-line bg-surface">
                        {s.image && (
                          <Image src={s.image} alt="" fill sizes="40px" className="object-contain p-[2px]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">{s.text}</span>
                      <span className="tnum shrink-0 text-body-sm font-semibold text-ink">
                        {formatPrice(s.price)}
                      </span>
                    </>
                  ) : s.type === "category" ? (
                    <>
                      <TrendingUp className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-ink">{s.text}</span>
                      <span className="shrink-0 text-body-sm text-ink-3">Department</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        <Highlight text={s.text} query={query} />
                      </span>
                      {s.scope && <span className="shrink-0 text-body-sm text-brand">in {s.scope}</span>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              recent={recent}
              categories={categories}
              onRecent={(term) => {
                setQuery(term);
                searchFor(term);
              }}
              onNavigate={close}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Before anything is typed the panel is still useful: what you searched for
 * last, and where the catalogue actually goes. The old dropdown showed nothing
 * until a keystroke.
 */
function EmptyState({
  recent,
  categories,
  onRecent,
  onNavigate,
}: {
  recent: string[];
  categories: Category[];
  onRecent: (term: string) => void;
  onNavigate: () => void;
}) {
  return (
    <div className="px-2 pb-2">
      {recent.length > 0 && (
        <section className="mb-4">
          <h2 className="px-1 py-2 text-label font-semibold uppercase tracking-wide text-ink-3">
            Recent searches
          </h2>
          <ul className="flex flex-col">
            {recent.map((term) => (
              <li key={term}>
                <button
                  type="button"
                  onClick={() => onRecent(term)}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left text-body text-ink transition-colors hover:bg-surface-sunk"
                >
                  <Clock className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{term}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="px-1 py-2 text-label font-semibold uppercase tracking-wide text-ink-3">
          Popular departments
        </h2>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/s?i=${c.id}`}
                onClick={onNavigate}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-body text-ink transition-colors hover:bg-surface-sunk"
              >
                <span className="min-w-0 truncate">{c.name}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Matched prefix regular, completion bold - the convention that makes a list scannable. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const idx = q ? text.toLowerCase().indexOf(q) : -1;
  if (idx === -1) return <span className="font-medium text-ink">{text}</span>;
  return (
    <span className="text-ink">
      {text.slice(0, idx)}
      <span className="font-normal">{text.slice(idx, idx + q.length)}</span>
      <span className="font-semibold">{text.slice(idx + q.length)}</span>
    </span>
  );
}

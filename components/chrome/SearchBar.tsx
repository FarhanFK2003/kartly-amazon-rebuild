"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Search, TrendingUp } from "lucide-react";
import { cn, splitPrice } from "@/lib/utils";
import { TID } from "@/lib/testids";
import type { Category } from "@/lib/types";
import type { Suggestion } from "@/lib/suggest";

interface SearchBarProps {
  categories: Category[];
  className?: string;
  autoFocusOnMount?: boolean;
}

/**
 * Header search with autocomplete.
 *
 * The form is a real GET form pointed at /s, and everything below is a
 * progressive enhancement on top. That matters for more than purity: before
 * hydration completes, an actionless form would submit to the current page and
 * send the shopper somewhere meaningless. With JavaScript off, typing and
 * pressing Enter still searches correctly.
 *
 * Implements the combobox pattern: the input owns aria-activedescendant while
 * the listbox owns the options, so a screen reader announces the highlighted
 * suggestion without focus ever leaving the field.
 */
export function SearchBar({ categories, className, autoFocusOnMount }: SearchBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // "k" is accepted as a legacy alias so older links keep working.
  const urlQuery = params.get("q") ?? params.get("k") ?? "";
  const urlScope = params.get("i") ?? "all";

  const [query, setQuery] = useState(urlQuery);
  const [scope, setScope] = useState(urlScope);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Portals need document, which only exists after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Keep the field in step with back/forward navigation and in-app links.
  useEffect(() => setQuery(urlQuery), [urlQuery]);
  useEffect(() => setScope(urlScope), [urlScope]);

  useEffect(() => {
    if (autoFocusOnMount) inputRef.current?.focus();
  }, [autoFocusOnMount]);

  /* ---------- fetching ---------- */

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
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        cache.current.set(term.toLowerCase(), data.suggestions);
        setSuggestions(data.suggestions);
      } catch {
        // Aborted or offline: leave the previous suggestions in place rather
        // than blanking the list mid-type.
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [query]);

  /* ---------- dismissal ---------- */

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  /* ---------- navigation ---------- */

  function go(href: string) {
    close();
    inputRef.current?.blur();
    router.push(href);
  }

  function searchFor(term: string, scopeId?: string) {
    const search = new URLSearchParams();
    if (term.trim()) search.set("q", term.trim());
    const s = scopeId ?? (scope !== "all" ? scope : "");
    if (s) search.set("i", s);
    go(`/s${search.toString() ? `?${search}` : ""}`);
  }

  function applySuggestion(s: Suggestion) {
    if (s.type === "product") return go(`/dp/${s.slug}`);
    if (s.type === "category") return go(`/s?i=${s.id}`);
    setQuery(s.text);
    searchFor(s.text, s.scopeId);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (open && active >= 0 && suggestions[active]) {
      applySuggestion(suggestions[active]);
      return;
    }
    searchFor(query);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Home") {
      setActive(0);
    } else if (e.key === "End") {
      setActive(suggestions.length - 1);
    }
  }

  const showList = open && suggestions.length > 0;
  const activeCategory = categories.find((c) => c.id === scope);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* Dims the page behind the open dropdown.
          Portalled to <body> at z-40: the header is z-50, so it paints above the
          scrim and the search field stays lit while everything else recedes.
          Rendering it inside the header instead would trap it in the header's
          stacking context, where it can only ever cover the header itself. */}
      {mounted && showList && createPortal(
        <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={close} />,
        document.body
      )}

      <form
        role="search"
        action="/s"
        method="get"
        onSubmit={submit}
        className="flex h-10 w-full items-stretch overflow-hidden rounded-[8px] bg-white focus-within:shadow-[0_0_0_3px_#f90]"
      >
        {/*
          Department scope.

          A native select takes its width from its widest option, so a list
          containing "Clothing & Accessories" made this 171px wide even while it
          read "All" - nearly a quarter of the search bar spent on one word. The
          reference sizes the control to the current selection instead.

          The hidden span carries the selected label and sets the width; the
          select is laid over it. Capped so a long department name cannot eat
          the field, and the label truncates rather than pushing it wider.
        */}
        <div className="relative hidden shrink-0 sm:block">
          <span
            aria-hidden
            className="invisible block max-w-[150px] truncate pl-3 pr-7 text-[12px] leading-10"
          >
            {activeCategory ? activeCategory.name : "All"}
          </span>
          <select
            name="i"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            aria-label="Search in department"
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none truncate rounded-l-[8px] border-r border-[#cdcdcd] bg-[#e6e6e6] pl-3 pr-6 text-[12px] text-[#555] hover:bg-[#dadada] focus:outline-none"
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-[#555]" aria-hidden>
            <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>

        <input
          ref={inputRef}
          name="q"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={activeCategory ? `Search ${activeCategory.name}` : "Search Kartly"}
          aria-label="Search Kartly"
          data-testid={TID.searchInput}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listboxId}-opt-${active}` : undefined}
          className="min-w-0 flex-1 bg-white px-3 text-[15px] text-ink placeholder:text-[#888] focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />

        <button
          type="submit"
          aria-label="Go"
          className="flex w-[45px] shrink-0 items-center justify-center bg-search text-ink hover:bg-search-hover"
        >
          <Search className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </button>
      </form>

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-[42px] z-50 overflow-hidden rounded-[4px] border border-[#c7c7c7] bg-white py-1 shadow-[0_2px_10px_rgba(0,0,0,.25)]"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.type}-${s.type === "product" ? s.slug : s.text}`}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              // pointerdown fires before the input blurs, so the click lands.
              onPointerDown={(e) => {
                e.preventDefault();
                applySuggestion(s);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-4 py-[6px] text-[15px]",
                i === active ? "bg-[#f0f2f2]" : "bg-white"
              )}
            >
              {s.type === "product" ? (
                <ProductRow suggestion={s} />
              ) : s.type === "category" ? (
                <>
                  <TrendingUp className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink">{s.text}</span>
                  <span className="shrink-0 text-[13px] text-muted">Department</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    <Highlight text={s.text} query={query} />
                  </span>
                  {s.scope && <span className="shrink-0 text-[13px] text-link">in {s.scope}</span>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductRow({ suggestion }: { suggestion: Extract<Suggestion, { type: "product" }> }) {
  const { symbol, whole, fraction } = splitPrice(suggestion.price);
  return (
    <>
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[4px] bg-white">
        {suggestion.image && (
          <Image src={suggestion.image} alt="" fill sizes="32px" className="object-contain" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{suggestion.text}</span>
      <span className="shrink-0 text-[13px] font-bold text-ink">
        {symbol}
        {whole}.{fraction}
      </span>
    </>
  );
}

/**
 * Matched prefix stays regular, the completion goes bold - the convention that
 * makes a suggestion list scannable at a glance.
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const idx = q ? text.toLowerCase().indexOf(q) : -1;
  if (idx === -1) return <span className="font-bold text-ink">{text}</span>;

  return (
    <span className="text-ink">
      {text.slice(0, idx)}
      <span className="font-normal">{text.slice(idx, idx + q.length)}</span>
      <span className="font-bold">{text.slice(idx + q.length)}</span>
    </span>
  );
}

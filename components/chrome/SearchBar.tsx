"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

interface SearchBarProps {
  categories: Category[];
  className?: string;
  autoFocusOnMount?: boolean;
}

/**
 * Header search. Autocomplete lands in P1; for now this handles the mechanics:
 * typing, Enter, the button, the department scope, and reflecting the active
 * query back out of the URL so a shared /s?k=... link repopulates the field.
 *
 * The form is a real GET form pointed at /s, and the submit handler is a
 * progressive enhancement on top. That matters for more than purity: before
 * hydration completes, an actionless form would submit to the current page and
 * send the shopper somewhere meaningless. This way the very first keystroke
 * after paint still searches correctly.
 */
export function SearchBar({ categories, className, autoFocusOnMount }: SearchBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // "k" is accepted as a legacy alias so older links keep working.
  const urlQuery = params.get("q") ?? params.get("k") ?? "";
  const urlScope = params.get("i") ?? "all";

  const [query, setQuery] = useState(urlQuery);
  const [scope, setScope] = useState(urlScope);

  // Keep the field in step with back/forward navigation and in-app links.
  useEffect(() => setQuery(urlQuery), [urlQuery]);
  useEffect(() => setScope(urlScope), [urlScope]);

  useEffect(() => {
    if (autoFocusOnMount) inputRef.current?.focus();
  }, [autoFocusOnMount]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    const search = new URLSearchParams();
    if (trimmed) search.set("q", trimmed);
    if (scope && scope !== "all") search.set("i", scope);
    router.push(`/s${search.toString() ? `?${search}` : ""}`);
  }

  const activeCategory = categories.find((c) => c.id === scope);

  return (
    <form
      role="search"
      action="/s"
      method="get"
      onSubmit={submit}
      className={cn(
        "flex h-10 w-full items-stretch overflow-hidden rounded-[8px] bg-white",
        "focus-within:shadow-[0_0_0_3px_#f90]",
        className
      )}
    >
      {/* department scope */}
      <div className="relative hidden shrink-0 sm:block">
        <select
          name="i"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          aria-label="Search in department"
          className={cn(
            "h-full cursor-pointer appearance-none rounded-l-[8px] border-r border-[#cdcdcd] bg-[#e6e6e6]",
            "pl-3 pr-6 text-[12px] text-[#555] hover:bg-[#dadada] focus:outline-none"
          )}
        >
          <option value="all">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute right-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-[#555]"
          aria-hidden
        >
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>

      <input
        ref={inputRef}
        name="q"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={activeCategory ? `Search ${activeCategory.name}` : "Search Kartly"}
        aria-label="Search Kartly"
        autoComplete="off"
        className={cn(
          "min-w-0 flex-1 bg-white px-3 text-[15px] text-ink placeholder:text-[#888]",
          "focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        )}
      />

      <button
        type="submit"
        aria-label="Go"
        className="flex w-[45px] shrink-0 items-center justify-center bg-search text-ink hover:bg-search-hover"
      >
        <Search className="h-[22px] w-[22px]" strokeWidth={2.2} />
      </button>
    </form>
  );
}

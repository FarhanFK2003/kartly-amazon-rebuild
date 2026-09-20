import Link from "next/link";
import { facetsToHref, setFacet, type Facets } from "@/lib/search";
import { cn } from "@/lib/utils";

/** Numbered pager that keeps every active filter and the sort order. */
export function Pagination({ facets, page, pageCount }: { facets: Facets; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 2
  );

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 py-8" aria-label="Search results pages">
      <PageLink href={facetsToHref(setFacet(facets, "page", page - 1))} disabled={page === 1} label="Previous page">
        Previous
      </PageLink>

      {pages.map((p, idx) => (
        <span key={p} className="flex items-center gap-2">
          {idx > 0 && p - pages[idx - 1] > 1 && <span className="px-1 text-muted">&hellip;</span>}
          <PageLink href={facetsToHref(setFacet(facets, "page", p))} current={p === page} label={`Page ${p}`}>
            {p}
          </PageLink>
        </span>
      ))}

      <PageLink href={facetsToHref(setFacet(facets, "page", page + 1))} disabled={page === pageCount} label="Next page">
        Next
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  children,
  current,
  disabled,
  label,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  label: string;
}) {
  const base = "flex h-9 min-w-9 items-center justify-center rounded-[8px] border px-3 text-[14px]";

  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(base, "border-line bg-[#f7f8f8] text-faint")}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cn(
        base,
        current ? "border-[#e77600] bg-[#fef8f2] font-bold text-ink" : "border-line bg-white text-ink hover:bg-[#f7fafa]"
      )}
    >
      {children}
    </Link>
  );
}

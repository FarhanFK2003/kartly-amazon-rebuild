import Link from "next/link";
import { X } from "lucide-react";
import {
  clearedFacets,
  facetsToHref,
  setFacet,
  toggleFacet,
  PRICE_BRACKETS,
  type Facets,
} from "@/lib/search-params";
import { getCategoryNames } from "@/lib/data/products";
import { TID } from "@/lib/testids";

/**
 * Everything currently applied, each removable on its own, plus a clear-all.
 *
 * With filters in dropdowns rather than a permanent rail, this row is the only
 * standing statement of what is narrowing the results, so it earns its place
 * more than it did when a rail was on screen anyway. Each chip is a link to the
 * same view minus that one refinement.
 */
export async function ActiveFilters({ facets }: { facets: Facets }) {
  const chips: { label: string; href: string }[] = [];

  // One lookup for every chip, shared with the rest of the render through the
  // read layer's per-request cache.
  const categoryNames = await getCategoryNames();

  for (const id of facets.categories) {
    chips.push({
      label: categoryNames[id] ?? id,
      href: facetsToHref(toggleFacet(facets, "categories", id)),
    });
  }
  for (const brand of facets.brands) {
    chips.push({ label: brand, href: facetsToHref(toggleFacet(facets, "brands", brand)) });
  }
  for (const price of facets.prices) {
    chips.push({
      label: PRICE_BRACKETS.find((b) => b.id === price)?.label ?? price,
      href: facetsToHref(toggleFacet(facets, "prices", price)),
    });
  }
  for (const attr of facets.attrs) {
    const [, ...rest] = attr.split(":");
    chips.push({ label: rest.join(":"), href: facetsToHref(toggleFacet(facets, "attrs", attr)) });
  }
  if (facets.rating) {
    chips.push({ label: `${facets.rating} stars & up`, href: facetsToHref(setFacet(facets, "rating", 0)) });
  }
  if (facets.inStockOnly) {
    chips.push({ label: "In stock only", href: facetsToHref(setFacet(facets, "inStockOnly", false)) });
  }
  if (facets.dealsOnly) {
    chips.push({ label: "All discounts", href: facetsToHref(setFacet(facets, "dealsOnly", false)) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <Link
          key={chip.label + chip.href}
          href={chip.href}
          data-testid={TID.activeFilterChip}
          className="inline-flex items-center gap-[6px] rounded-[var(--radius-btn)] border border-brand bg-brand-tint py-[5px] pl-3 pr-2 text-body-sm font-medium text-brand transition-colors hover:bg-[#dbe7e4]"
        >
          {chip.label}
          <X className="h-[14px] w-[14px]" aria-label={`Remove ${chip.label} filter`} />
        </Link>
      ))}
      <Link
        href={facetsToHref(clearedFacets(facets))}
        className="ml-1 text-body-sm font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline"
      >
        Clear all
      </Link>
    </div>
  );
}

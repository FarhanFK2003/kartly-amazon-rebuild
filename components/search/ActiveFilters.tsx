import Link from "next/link";
import { X } from "lucide-react";
import {
  clearedFacets,
  facetsToHref,
  setFacet,
  toggleFacet,
  PRICE_BRACKETS,
  type Facets,
} from "@/lib/search";
import { getCategory } from "@/lib/catalog";

/**
 * Chips for everything currently applied, each removable on its own, plus a
 * clear-all. Without this a shopper who scrolled past the rail has no idea why
 * the result count dropped.
 */
export function ActiveFilters({ facets }: { facets: Facets }) {
  const chips: { label: string; href: string }[] = [];

  for (const id of facets.categories) {
    chips.push({
      label: getCategory(id)?.name ?? id,
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
    <div className="flex flex-wrap items-center gap-2 py-3" aria-label="Active filters">
      <span className="text-[13px] font-bold text-ink">Filters:</span>
      {chips.map((chip) => (
        <Link
          key={chip.label + chip.href}
          href={chip.href}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-[3px] pl-3 pr-2 text-[12px] text-ink hover:border-[#007185] hover:text-link"
        >
          {chip.label}
          <X className="h-3 w-3" aria-label={`Remove ${chip.label} filter`} />
        </Link>
      ))}
      <Link href={facetsToHref(clearedFacets(facets))} className="link ml-1 text-[13px]">
        Clear all
      </Link>
    </div>
  );
}

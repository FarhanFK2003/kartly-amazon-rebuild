import Link from "next/link";
import { Check, Star } from "lucide-react";
import {
  facetsToHref,
  setFacet,
  toggleFacet,
  type FacetModel,
  type FacetOption,
  type Facets,
} from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";

/*
  One facet group, rendered as links.

  Every control here rewrites the querystring rather than setting React state,
  which is what keeps a filtered view shareable, the back button honest, and
  the whole filter set working with JavaScript off. The tick is drawn, not an
  <input>, because there is no form to submit - each option is a destination.

  Counts come from lib/search, which computes each facet with every *other*
  facet applied, so a count says what adding this filter would return rather
  than what is already on screen. Nothing here is hard-coded.

  The same component serves the desktop popovers and the mobile sheet, so the
  two can never drift apart.
*/

export type FacetKey = "categories" | "brands" | "prices" | "rating" | "deals" | "availability";

export const FACET_LABELS: Record<FacetKey, string> = {
  categories: "Department",
  brands: "Brand",
  prices: "Price",
  rating: "Rating",
  deals: "Offers",
  availability: "Availability",
};

/** True when a group has anything worth showing. */
export function facetHasOptions(model: FacetModel, key: FacetKey): boolean {
  if (key === "categories") return model.categories.length > 1;
  if (key === "brands") return model.brands.length > 1;
  if (key === "prices") return model.prices.length > 1;
  if (key === "rating") return model.ratings.length > 0;
  if (key === "deals") return model.deals.some((d) => d.count > 0);
  return model.availability.some((a) => a.count > 0);
}

export function FacetGroup({
  facets,
  model,
  group,
}: {
  facets: Facets;
  model: FacetModel;
  group: FacetKey;
}) {
  if (group === "rating") {
    return (
      <ul className="flex flex-col">
        {model.ratings.map((o) => (
          <li key={o.value}>
            <Link
              href={facetsToHref(setFacet(facets, "rating", o.selected ? 0 : Number(o.value)))}
              aria-pressed={o.selected}
              data-testid={TID.facetOption}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-[7px] text-body",
                "transition-colors hover:bg-surface-sunk",
                o.selected && "bg-brand-tint"
              )}
            >
              <Tick selected={o.selected} />
              <span className="flex items-center gap-[2px] text-ink">
                {Array.from({ length: Number(o.value) }, (_, i) => (
                  <Star key={i} className="h-[13px] w-[13px] fill-current text-brand" aria-hidden />
                ))}
                <span className="ml-1">&amp; up</span>
              </span>
              <span className="tnum ml-auto text-body-sm text-ink-3">{o.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (group === "deals" || group === "availability") {
    const option = group === "deals" ? model.deals[0] : model.availability[0];
    if (!option) return null;
    const href =
      group === "deals"
        ? facetsToHref(setFacet(facets, "dealsOnly", !facets.dealsOnly))
        : facetsToHref(setFacet(facets, "inStockOnly", !facets.inStockOnly));

    return (
      <ul className="flex flex-col">
        <li>
          <Row href={href} option={option} />
        </li>
      </ul>
    );
  }

  const options: FacetOption[] =
    group === "categories" ? model.categories : group === "brands" ? model.brands : model.prices;

  return (
    <ul className="flex flex-col">
      {options.map((o) => (
        <li key={o.value}>
          <Row href={facetsToHref(toggleFacet(facets, group, o.value))} option={o} />
        </li>
      ))}
    </ul>
  );
}

function Row({ href, option }: { href: string; option: FacetOption }) {
  return (
    <Link
      href={href}
      aria-pressed={option.selected}
      data-testid={TID.facetOption}
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-[7px] text-body",
        "transition-colors hover:bg-surface-sunk",
        option.selected && "bg-brand-tint"
      )}
    >
      <Tick selected={option.selected} />
      <span className={cn("min-w-0 flex-1 truncate", option.selected ? "font-medium text-ink" : "text-ink")}>
        {option.label}
      </span>
      <span className="tnum shrink-0 text-body-sm text-ink-3">{option.count}</span>
    </Link>
  );
}

/** Drawn rather than an <input>: these are links, and there is no form. */
function Tick({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border",
        selected ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"
      )}
    >
      {selected && <Check className="h-[11px] w-[11px]" strokeWidth={3} />}
    </span>
  );
}

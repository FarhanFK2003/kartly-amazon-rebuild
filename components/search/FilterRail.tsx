import Link from "next/link";
import {
  facetsToHref,
  toggleFacet,
  setFacet,
  type FacetModel,
  type FacetOption,
  type Facets,
} from "@/lib/search";
import { StarRating } from "@/components/ui/StarRating";
import { cn } from "@/lib/utils";

/*
  Filter rail.

  Every control is a link that rewrites the querystring rather than a form
  control, so each filtered view has a real shareable URL, the back button
  works, and the whole rail keeps working with JavaScript off. The checkbox is
  drawn, not an <input>.
*/

export function FilterRail({ facets, model }: { facets: Facets; model: FacetModel }) {
  return (
    <div className="pb-6">
      <Group title="Department">
        {model.categories.map((o) => (
          <CheckRow key={o.value} option={o} href={facetsToHref(toggleFacet(facets, "categories", o.value))} />
        ))}
      </Group>

      {model.brands.length > 1 && (
        <Group title="Brand">
          {model.brands.map((o) => (
            <CheckRow key={o.value} option={o} href={facetsToHref(toggleFacet(facets, "brands", o.value))} />
          ))}
        </Group>
      )}

      <Group title="Customer Reviews">
        {model.ratings.map((o) => (
          <li key={o.value}>
            <Link
              href={facetsToHref(setFacet(facets, "rating", o.selected ? 0 : Number(o.value)))}
              className="flex items-center gap-2 py-[5px] text-[14px] hover:text-link-hover hover:underline"
              aria-pressed={o.selected}
            >
              <StarRating rating={Number(o.value)} size="sm" />
              <span className={cn("text-[13px]", o.selected ? "font-bold text-ink" : "text-ink")}>
                &amp; Up
              </span>
              <span className="text-[12px] text-muted">({o.count})</span>
            </Link>
          </li>
        ))}
      </Group>

      {model.prices.length > 1 && (
        <Group title="Price">
          {model.prices.map((o) => (
            <CheckRow key={o.value} option={o} href={facetsToHref(toggleFacet(facets, "prices", o.value))} />
          ))}
        </Group>
      )}

      {model.attributes.map((attr) => (
        <Group key={attr.key} title={attr.key}>
          {attr.options.map((o) => (
            <CheckRow key={o.value} option={o} href={facetsToHref(toggleFacet(facets, "attrs", o.value))} />
          ))}
        </Group>
      ))}

      <Group title="Availability">
        <CheckRow
          option={{
            value: "avail",
            label: "In stock only",
            count: model.availability[0]?.count ?? 0,
            selected: facets.inStockOnly,
          }}
          href={facetsToHref(setFacet(facets, "inStockOnly", !facets.inStockOnly))}
        />
      </Group>

      <Group title="Deals &amp; Discounts" last>
        <CheckRow
          option={{
            value: "deals",
            label: "All discounts",
            count: model.deals[0]?.count ?? 0,
            selected: facets.dealsOnly,
          }}
          href={facetsToHref(setFacet(facets, "dealsOnly", !facets.dealsOnly))}
        />
      </Group>
    </div>
  );
}

function Group({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={cn("py-4", !last && "border-b border-line-soft")}>
      <h3 className="mb-1 text-[15px] font-bold text-ink" dangerouslySetInnerHTML={{ __html: title }} />
      <ul>{children}</ul>
    </section>
  );
}

function CheckRow({ option, href }: { option: FacetOption; href: string }) {
  return (
    <li>
      <Link
        href={href}
        aria-pressed={option.selected}
        className="group flex items-center gap-2 py-[5px] text-[14px] text-ink hover:text-link-hover"
      >
        <span
          aria-hidden
          className={cn(
            "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[2px] border",
            option.selected
              ? "border-[#007185] bg-[#007185] text-white"
              : "border-[#888c8c] bg-white group-hover:border-[#007185]"
          )}
        >
          {option.selected && (
            <svg viewBox="0 0 12 12" className="h-3 w-3">
              <path d="M2.5 6.2 4.8 8.5 9.5 3.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className={cn("min-w-0 flex-1 truncate group-hover:underline", option.selected && "font-bold")}>
          {option.label}
        </span>
        <span className="shrink-0 text-[12px] text-muted">({option.count})</span>
      </Link>
    </li>
  );
}

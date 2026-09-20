import Link from "next/link";
import { getCategories } from "@/lib/catalog";
import { buildSearchHref, PRICE_BRACKETS, type SearchParamsShape } from "@/lib/search";
import { StarRating } from "@/components/ui/StarRating";
import { cn } from "@/lib/utils";

/*
  Filter rail.

  Filters are links that rewrite the querystring, not form controls. Every
  filtered view therefore has a real URL that can be shared and that the back
  button understands. Single-select for now; multi-select facets with live
  counts are P1 #11.
*/

export function FilterRail({ params }: { params: SearchParamsShape }) {
  const categories = getCategories();
  const activeDept = params.i && params.i !== "all" ? params.i : "";
  const activeRating = Number(params.rating ?? 0);
  const activeMin = Number(params.min ?? 0);
  const activeMax = Number(params.max ?? 0);

  return (
    <aside className="w-full lg:w-[240px] lg:shrink-0" aria-label="Filters">
      <Group title="Department">
        <ul>
          <RailLink href={buildSearchHref(params, { i: null })} active={!activeDept} bold>
            Any Department
          </RailLink>
          {categories.map((c) => (
            <RailLink
              key={c.id}
              href={buildSearchHref(params, { i: activeDept === c.id ? null : c.id })}
              active={activeDept === c.id}
            >
              {c.name}
            </RailLink>
          ))}
        </ul>
      </Group>

      <Group title="Customer Reviews">
        <ul>
          {[4, 3, 2, 1].map((stars) => (
            <li key={stars}>
              <Link
                href={buildSearchHref(params, { rating: activeRating === stars ? null : stars })}
                className={cn(
                  "flex items-center gap-2 py-[5px] text-[14px] hover:text-link-hover hover:underline",
                  activeRating === stars ? "font-bold text-ink" : "text-ink"
                )}
              >
                <StarRating rating={stars} size="sm" />
                <span className="text-[13px]">&amp; Up</span>
              </Link>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Price">
        <ul>
          {PRICE_BRACKETS.map((b) => {
            const active = activeMin === b.min && activeMax === b.max;
            return (
              <RailLink
                key={b.label}
                href={buildSearchHref(params, {
                  min: active || !b.min ? null : b.min,
                  max: active || !b.max ? null : b.max,
                })}
                active={active}
              >
                {b.label}
              </RailLink>
            );
          })}
        </ul>
      </Group>

      <Group title="Deals &amp; Discounts" last>
        <ul>
          <RailLink
            href={buildSearchHref(params, { deals: params.deals === "1" ? null : "1" })}
            active={params.deals === "1"}
          >
            All Discounts
          </RailLink>
        </ul>
      </Group>
    </aside>
  );
}

function Group({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={cn("py-4", !last && "border-b border-line-soft")}>
      <h2
        className="mb-1 text-[15px] font-bold text-ink"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {children}
    </section>
  );
}

function RailLink({
  href,
  active,
  bold,
  children,
}: {
  href: string;
  active?: boolean;
  bold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "block py-[5px] text-[14px] hover:text-link-hover hover:underline",
          active || bold ? "font-bold text-ink" : "text-ink"
        )}
        aria-current={active ? "true" : undefined}
      >
        {children}
      </Link>
    </li>
  );
}

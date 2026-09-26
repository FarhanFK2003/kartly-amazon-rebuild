import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { getCategory } from "@/lib/data/products";
import { searchProducts } from "@/lib/data/search";
import {
  activeFilterCount,
  parseFacets,
  PAGE_SIZE,
  type RawSearchParams,
} from "@/lib/search-params";
import { TID } from "@/lib/testids";
import { ProductCard } from "@/components/product/ProductCard";
import { FacetBar } from "@/components/search/FacetBar";
import { FilterSheet } from "@/components/search/FilterSheet";
import { SortControl } from "@/components/search/SortControl";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { Pagination } from "@/components/search/Pagination";
import { ButtonLink } from "@/components/ui/Button";

// Results come from a live database, so this page is rendered per request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const facets = parseFacets(await searchParams);
  if (facets.q) return { title: facets.q };
  if (facets.categories.length === 1) {
    return { title: (await getCategory(facets.categories[0]))?.name ?? "Search" };
  }
  return { title: "All products" };
}

/*
  Discovery.

  Grid-first, and full width. The replica spent a 240px left column on a filter
  rail that permanently narrowed the results it existed to refine, then laid
  those results out as full-width rows - one product per 200px of vertical
  space. Kartly puts the facets in a row above the grid and gives the whole
  width to product, so a desktop viewport shows sixteen products instead of
  four.

  Every control here is still a link that rewrites the querystring. The URL
  remains the single source of truth for what is being shown: query, department,
  brand, price, rating, offers, availability, sort and page all survive a
  reload, a share, and the back button.
*/
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const facets = parseFacets(await searchParams);
  const { items, total, page, pageCount, facets: model, browsing } = await searchProducts(facets);

  const department =
    facets.categories.length === 1 ? await getCategory(facets.categories[0]) : undefined;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = (page - 1) * PAGE_SIZE + items.length;
  const activeCount = activeFilterCount(facets);

  const heading = facets.q
    ? `Results for “${facets.q}”`
    : department
      ? department.name
      : "All products";

  return (
    <div className="shell py-6 sm:py-8">
      {/* context -------------------------------------------------------- */}
      <header className="mb-5">
        <h1 className="font-display text-display-md font-medium text-ink sm:text-display-lg">{heading}</h1>
        <p className="mt-1 text-body text-ink-2">
          {total === 0 ? (
            "No matching products"
          ) : (
            <>
              <span className="tnum">
                {first}&ndash;{last}
              </span>{" "}
              of <span className="tnum font-medium text-ink">{total}</span>{" "}
              {total === 1 ? "product" : "products"}
              {department && <> in {department.name}</>}
            </>
          )}
        </p>
      </header>

      {/* controls ------------------------------------------------------- */}
      <div className="sticky top-[52px] z-[40] -mx-4 mb-4 border-y border-line bg-paper/95 px-4 py-3 backdrop-blur-[6px] lg:top-[56px]">
        {/*
          One sheet, one sort control, one facet bar - each rendered exactly
          once. Position is handled with flex order rather than by rendering a
          mobile copy and a desktop copy, which would put two dialogs, two
          scrims and a duplicate id in the document.
        */}
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <FilterSheet
              facets={facets}
              model={model}
              activeCount={activeCount}
              resultCount={total}
              className="order-1"
            />

            <div className="order-3 lg:order-2">
              <FacetBar facets={facets} model={model} />
            </div>

            <div className="order-2 ml-auto lg:order-3">
              <SortControl facets={facets} />
            </div>
          </Suspense>
        </div>

        {activeCount > 0 && (
          <div className="mt-3">
            <ActiveFilters facets={facets} />
          </div>
        )}
      </div>

      {/* results -------------------------------------------------------- */}
      {items.length === 0 ? (
        <NoResults query={facets.q} hasFilters={activeCount > 0} />
      ) : (
        <>
          <ul
            data-testid={TID.productGrid}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5"
          >
            {items.map((p, idx) => (
              <li key={p.id} className="flex">
                <ProductCard product={p} priority={idx < 4} className="w-full" />
              </li>
            ))}
          </ul>

          <Pagination facets={facets} page={page} pageCount={pageCount} />
        </>
      )}

      {browsing && total > 0 && (
        <p className="pb-4 text-center text-body-sm text-ink-3">
          Browsing the full catalogue. Use search or the filters to narrow it down.
        </p>
      )}
    </div>
  );
}

function NoResults({ query, hasFilters }: { query: string; hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center sm:py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunk">
        <SearchX className="h-7 w-7 text-ink-3" strokeWidth={1.6} aria-hidden />
      </div>
      <h2 className="mt-4 font-display text-display-sm font-medium text-ink">
        {query ? <>Nothing matched &ldquo;{query}&rdquo;</> : "Nothing matches those filters"}
      </h2>
      <p className="mt-2 max-w-[440px] text-body text-ink-2">
        {hasFilters
          ? "Try removing a filter, or search for something more general."
          : "Try checking the spelling, or use fewer and more general words."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/s" variant="primary" size="md">
          {hasFilters ? "Clear all filters" : "Browse all products"}
        </ButtonLink>
        <Link href="/browse" className="text-body font-medium text-brand-ink hover:underline">
          Browse departments
        </Link>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getCategory } from "@/lib/catalog";
import { searchCatalog, type SearchParamsShape } from "@/lib/search";
import { ProductCard } from "@/components/product/ProductCard";
import { FilterRail } from "@/components/search/FilterRail";
import { SortSelect } from "@/components/search/SortSelect";
import { Pagination } from "@/components/search/Pagination";
import { ButtonLink } from "@/components/ui/Button";

type RawParams = SearchParamsShape & { k?: string };

/** "k" is the legacy alias the header used before the switch to "q". */
function normalise(raw: RawParams): SearchParamsShape {
  const { k, ...rest } = raw;
  return { ...rest, q: rest.q ?? k ?? "" };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}): Promise<Metadata> {
  const params = normalise(await searchParams);
  const dept = params.i ? getCategory(params.i) : undefined;
  if (params.q) return { title: `${params.q}` };
  if (dept) return { title: dept.name };
  return { title: "All products" };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = normalise(await searchParams);
  const { items, total, page, pageCount, query, sort, browsing } = searchCatalog(params);
  const department = params.i && params.i !== "all" ? getCategory(params.i) : undefined;

  const first = (page - 1) * 16 + 1;
  const last = (page - 1) * 16 + items.length;

  return (
    <div className="bg-white">
      {/* results toolbar */}
      <div className="border-b border-line bg-white">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-[14px] text-ink">
            {total === 0 ? (
              <>No results{query && <> for <Query>{query}</Query></>}</>
            ) : (
              <>
                {first}-{last} of {total > 999 ? "over 1,000" : total}{" "}
                {total === 1 ? "result" : "results"}
                {query && <> for <Query>{query}</Query></>}
                {department && (
                  <>
                    {" "}
                    in <span className="font-bold">{department.name}</span>
                  </>
                )}
              </>
            )}
          </p>
          <SortSelect params={params} sort={sort} />
        </div>
      </div>

      <div className="shell flex flex-col gap-6 lg:flex-row lg:gap-8">
        <FilterRail params={params} />

        <div className="min-w-0 flex-1 pb-4">
          <div className="pt-4">
            <h1 className="text-[21px] font-bold text-ink">
              {query ? "Results" : department ? department.name : "All products"}
            </h1>
            <p className="text-[13px] text-muted">
              {browsing
                ? "Browse the full catalogue, or search for something specific."
                : "Check each product page for other buying options."}
            </p>
          </div>

          {items.length === 0 ? (
            <NoResults query={query} />
          ) : (
            <>
              <div className="divide-y divide-line-soft">
                {items.map((p, idx) => (
                  <ProductCard key={p.id} product={p} variant="row" priority={idx < 2} />
                ))}
              </div>
              <Pagination params={params} page={page} pageCount={pageCount} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Query({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-[#c7511f]">&quot;{children}&quot;</span>;
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-[21px] font-bold text-ink">
        No results for {query ? <Query>{query}</Query> : "those filters"}.
      </p>
      <p className="mx-auto mt-2 max-w-[460px] text-[14px] text-muted">
        Try checking your spelling, using fewer or more general words, or clearing a filter.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/s" variant="primary" size="md">
          Browse all products
        </ButtonLink>
        <Link href="/" className="link text-[14px]">
          Go to the homepage
        </Link>
      </div>
    </div>
  );
}

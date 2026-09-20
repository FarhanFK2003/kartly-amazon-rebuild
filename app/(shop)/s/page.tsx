import { getAllProducts, getCategory } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";

/*
  PLACEHOLDER search route (P0 #4).

  Only enough to prove the header wiring: the query and department arrive from
  the URL and something sensible renders. Real matching, the filter rail, sort
  and pagination are P1 #11, and autocomplete is P1 #10.
*/

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string; i?: string; deals?: string }>;
}) {
  const { k = "", i = "", deals } = await searchParams;
  const query = k.trim();
  // "all" arrives from the department select when the form posts without JS.
  const department = i && i !== "all" ? i : "";

  let results = getAllProducts();
  if (department) results = results.filter((p) => p.categoryId === department);
  if (deals) results = results.filter((p) => p.dealPercent > 0);
  if (query) {
    const needle = query.toLowerCase();
    results = results.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.brand.toLowerCase().includes(needle) ||
        p.imageQuery.toLowerCase().includes(needle)
    );
  }

  const shown = results.slice(0, 16);
  const departmentInfo = department ? getCategory(department) : undefined;

  return (
    <div className="shell pb-8">
      <div className="-mx-4 border-b border-line bg-white px-4 py-3 sm:mx-0">
        <p className="text-[14px] text-ink">
          {results.length === 0 ? (
            <>
              No results for <span className="font-bold text-[#c7511f]">&quot;{query}&quot;</span>
            </>
          ) : (
            <>
              1-{shown.length} of {results.length > 999 ? "over 1,000" : results.length} results
              {query && (
                <>
                  {" "}
                  for <span className="font-bold text-[#c7511f]">&quot;{query}&quot;</span>
                </>
              )}
              {departmentInfo && <> in <span className="font-bold">{departmentInfo.name}</span></>}
            </>
          )}
        </p>
      </div>

      <div className="card mt-4 px-4">
        <h1 className="pt-4 text-[21px] font-bold">Results</h1>
        <p className="text-[13px] text-muted">Check each product page for other buying options.</p>

        {shown.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[18px] font-bold">No results found</p>
            <p className="mt-1 text-[13px] text-muted">Try a different search term or department.</p>
          </div>
        ) : (
          <div className="divide-y divide-line-soft">
            {shown.map((p, idx) => (
              <ProductCard key={p.id} product={p} variant="row" priority={idx < 2} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

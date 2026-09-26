import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  getCategory,
  getProductByIdOrSlug,
  getRelatedProducts,
} from "@/lib/data/products";
import { getBundle } from "@/lib/bundles";
import { TID } from "@/lib/testids";
import { Gallery } from "@/components/product/Gallery";
import { BuyBox } from "@/components/product/BuyBox";
import { VariantPicker } from "@/components/product/VariantPicker";
import { PdpProvider } from "@/components/product/PdpContext";
import { Reviews } from "@/components/product/Reviews";
import { RecordView } from "@/components/product/RecordView";
import { FrequentlyBoughtTogether } from "@/components/product/FrequentlyBoughtTogether";
import { Shelf } from "@/components/ui/Shelf";
import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";

/*
  Rendered per request, against the database.

  Every PDP used to be prerendered from the static catalogue, which was correct
  when the catalogue was a file compiled into the bundle. It is wrong now: a
  price corrected in PostgreSQL would have gone on showing the build-time value
  until the next deploy, and a storefront that cannot reflect its own database
  is the thing this migration exists to fix.

  So there is no generateStaticParams and no revalidate window - a change in the
  database is on the page at the next request. Incremental regeneration with an
  explicit revalidation hook is the obvious production refinement, but it needs
  a real invalidation path, and inventing one here would mean shipping a cache
  nothing knows how to clear. See docs/backend.md.
*/
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductByIdOrSlug(id);
  if (!product) return { title: "Product not found" };
  return {
    title: product.title.split(",")[0],
    description: product.bullets[0],
  };
}

/*
  Product detail.

  Two columns, not three. The replica put the gallery left, a wall of
  specification text in the middle and a boxed purchase panel pinned right -
  three competing centres of attention, with the decision itself trapped in the
  narrowest column at the edge of the screen.

  Kartly puts the product on the left and the whole decision on the right, in
  one uninterrupted column: what it is, what people think of it, what it costs,
  which one, how many, and the two actions. Everything that is reference rather
  than decision - the bullets, the specification, the description, the reviews -
  sits below the fold where it can have the full width and be read properly.

  Nothing on this page is invented. Every figure comes from the catalogue entry
  or from the commerce constants; the specification renders only the keys that
  product actually has.
*/
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductByIdOrSlug(id);
  if (!product) notFound();

  /*
    Issued together, and the two shelves share one read: "related" and "also
    viewed" are the same ranked list sliced at different points, so asking for
    eighteen once is cheaper than asking for ten and then eighteen.
  */
  const [category, relatedPool, bundle] = await Promise.all([
    getCategory(product.categoryId),
    getRelatedProducts(product, 18),
    getBundle(product),
  ]);
  const related = relatedPool.slice(0, 10);
  const alsoViewed = relatedPool.slice(8);
  const shortTitle = product.title.split(",")[0];

  return (
    <PdpProvider product={product}>
      <RecordView productId={product.id} />

      <div className="shell pb-16">
        {/* context ----------------------------------------------------- */}
        <nav
          aria-label="Breadcrumb"
          className="no-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap py-4 text-body-sm text-ink-3"
        >
          <Link href="/browse" className="tap-target shrink-0 transition-colors hover:text-brand">
            Browse
          </Link>
          {category && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <Link
                href={`/s?i=${category.id}`}
                className="tap-target shrink-0 transition-colors hover:text-brand"
              >
                {category.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate text-ink-2">{shortTitle}</span>
        </nav>

        {/* product + decision ------------------------------------------ */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-14">
          <div className="lg:sticky lg:top-[72px] lg:self-start">
            <Gallery product={product} />
          </div>

          <div className="min-w-0" data-testid={TID.pdpDecisionCard}>
            <p className="text-label font-semibold uppercase tracking-wide text-ink-3">
              <Link
                href={`/s?brand=${encodeURIComponent(product.brand)}`}
                className="transition-colors hover:text-brand"
              >
                {product.brand}
              </Link>
              {category && (
                <>
                  <span className="px-1">&middot;</span>
                  <Link
                    href={`/s?i=${category.id}`}
                    className="normal-case tracking-normal transition-colors hover:text-brand"
                  >
                    {category.name}
                  </Link>
                </>
              )}
            </p>

            <h1
              data-testid={TID.pdpTitle}
              className="mt-2 font-display text-[28px] font-medium leading-[1.15] text-ink sm:text-display-md lg:text-[34px]"
            >
              {product.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="#reviews" className="group inline-flex items-center gap-2">
                <StarRating rating={product.rating} size="sm" />
                <span className="tnum text-body-sm text-ink-2 group-hover:text-brand group-hover:underline">
                  {product.rating.toFixed(1)} &middot;{" "}
                  {product.reviewCount.toLocaleString("en-US")} reviews
                </span>
              </Link>

              {product.badges.includes("bestSeller") && <Badge variant="bestSeller">Best Seller</Badge>}
              {product.badges.includes("choice") && <Badge variant="choice">Kartly&apos;s Choice</Badge>}
            </div>

            {/* Price, stock, variant, quantity and the two actions. */}
            <BuyBox>
              <VariantPicker />
            </BuyBox>
          </div>
        </div>

        {/* reference --------------------------------------------------- */}
        <div className="mt-14 flex flex-col gap-12 sm:mt-20 sm:gap-16">
          <FrequentlyBoughtTogether bundle={bundle} />

          <section aria-labelledby="about-heading" className="border-t border-line pt-6">
            <h2 id="about-heading" className="font-display text-display-md font-medium text-ink">
              About this product
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-x-14 gap-y-8 lg:grid-cols-2">
              <div>
                <h3 className="text-label font-semibold uppercase tracking-wide text-ink-3">
                  Highlights
                </h3>
                <ul className="mt-3 space-y-2">
                  {product.bullets.map((b) => (
                    <li key={b} className="flex gap-3 text-body-lg leading-[26px] text-ink">
                      <span aria-hidden className="mt-[11px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-3" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Only the keys this product actually has. */}
              <div>
                <h3 className="text-label font-semibold uppercase tracking-wide text-ink-3">
                  Specification
                </h3>
                <dl data-testid={TID.pdpSpecs} className="mt-3">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex gap-4 border-b border-line py-[10px] text-body last:border-b-0"
                    >
                      <dt className="w-[42%] shrink-0 text-ink-2">{key}</dt>
                      <dd className="min-w-0 text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          <Reviews product={product} />

          <Shelf
            title="Related products"
            subtitle={category ? `More from ${category.name}` : undefined}
            products={related}
            href={category ? `/s?i=${category.id}` : "/s"}
          />

          {alsoViewed.length > 0 && (
            <Shelf title="Shoppers also viewed" products={alsoViewed} showCta={false} />
          )}
        </div>
      </div>
    </PdpProvider>
  );
}

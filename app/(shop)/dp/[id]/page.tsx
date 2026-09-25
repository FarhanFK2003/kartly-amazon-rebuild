import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  getAllProducts,
  getCategory,
  getProductByIdOrSlug,
  getRelatedProducts,
} from "@/lib/catalog";
import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";
import { Gallery } from "@/components/product/Gallery";
import { BuyBox } from "@/components/product/BuyBox";
import { VariantPicker } from "@/components/product/VariantPicker";
import { PdpProvider } from "@/components/product/PdpContext";
import { Reviews } from "@/components/product/Reviews";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { RecordView } from "@/components/product/RecordView";
import { FrequentlyBoughtTogether } from "@/components/product/FrequentlyBoughtTogether";
import { getBundle } from "@/lib/bundles";

/** All 120 products are known at build time, so every PDP is prerendered. */
export function generateStaticParams() {
  return getAllProducts().map((p) => ({ id: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = getProductByIdOrSlug(id);
  if (!product) return { title: "Product not found" };
  return {
    title: product.title.split(",")[0],
    description: product.bullets[0],
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProductByIdOrSlug(id);
  if (!product) notFound();

  const category = getCategory(product.categoryId);
  const related = getRelatedProducts(product, 10);
  const bundle = getBundle(product);
  const alsoViewed = getRelatedProducts(product, 18).slice(8);

  return (
    <PdpProvider product={product}>
      <RecordView productId={product.id} />
      <div className="bg-white">
        <div className="shell pb-10">
          {/* breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 py-3 text-[12px] text-muted">
            <Link href="/s" className="tap-target hover:text-link-hover hover:underline">
              All
            </Link>
            {category && (
              <>
                <ChevronRight className="h-3 w-3" aria-hidden />
                <Link href={`/s?i=${category.id}`} className="tap-target hover:text-link-hover hover:underline">
                  {category.name}
                </Link>
              </>
            )}
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="clamp-1 text-ink">{product.title.split(",")[0]}</span>
          </nav>

          {/* main three-column block */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)_300px] lg:gap-8">
            <div className="lg:sticky lg:top-[115px] lg:self-start">
              <Gallery product={product} />
            </div>

            <div className="min-w-0">
              <h1 className="text-[24px] font-normal leading-8 text-ink">{product.title}</h1>

              <Link href={`/s?q=${encodeURIComponent(product.brand)}`} className="link mt-1 inline-block text-[14px]">
                Visit the {product.brand} Store
              </Link>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StarRating
                  rating={product.rating}
                  count={product.reviewCount}
                  size="md"
                  showValue
                  showCaret
                  parenthesised
                  href="#reviews"
                />
                {product.badges.includes("bestSeller") && <Badge variant="bestSeller">Best Seller</Badge>}
                {product.badges.includes("choice") && <Badge variant="choice">Kartly&apos;s Choice</Badge>}
              </div>

              {product.boughtLastMonth > 0 && (
                <p className="mt-2 text-[13px] text-muted">
                  {product.boughtLastMonth.toLocaleString("en-US")}+ bought in past month
                </p>
              )}

              <hr className="my-3 border-line-soft" />

              <VariantPicker />

              <div className="mt-5">
                <h2 className="text-[16px] font-bold text-ink">About this item</h2>
                <ul className="mt-2 list-disc space-y-[6px] pl-5 text-[14px] leading-5 text-ink">
                  {product.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>

            </div>

            {/*
              One BuyBox, not two. Source order is gallery -> info -> buy box, so
              a single-column grid stacks it under the bullets on mobile and the
              three-column grid places it in the right rail on desktop. Rendering
              a second copy behind a media query would duplicate the quantity
              control and its aria-label in the accessibility tree.
            */}
            <div className="lg:sticky lg:top-[115px] lg:self-start">
              <BuyBox />
            </div>
          </div>

          {/* details */}
          <div className="mt-10 space-y-8">
            <FrequentlyBoughtTogether bundle={bundle} />

            <section className="border-t border-line-soft pt-6">
              <h2 className="text-[21px] font-bold text-ink">Product information</h2>
              <dl className="mt-3 max-w-[760px] divide-y divide-line-soft rounded-[8px] border border-line">
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key} className="flex gap-4 px-4 py-[10px] text-[14px] odd:bg-[#f7f8f8]">
                    <dt className="w-[45%] shrink-0 font-bold text-ink">{key}</dt>
                    <dd className="text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="border-t border-line-soft pt-6">
              <h2 className="text-[21px] font-bold text-ink">Product description</h2>
              <p className="mt-3 max-w-[820px] text-[14px] leading-6 text-ink">
                The {product.title.split(",")[0]} from {product.brand} is built for people who would
                rather buy once. {product.bullets[0]}, and {lowerFirst(product.bullets[1] ?? "")}
                {product.bullets[2] ? ` It also ${lowerFirst(product.bullets[2])}.` : "."}
              </p>
              <p className="mt-3 max-w-[820px] text-[14px] leading-6 text-ink">
                Every Kartly order ships with a 30-day refund window and free returns, so you can
                try it at home and send it back if it is not right.
              </p>
            </section>

            <RelatedProducts
              products={related}
              title="Products related to this item"
              subtitle={category ? `More from ${category.name}` : undefined}
            />

            <Reviews product={product} />

            <RelatedProducts products={alsoViewed} title="Customers who viewed this item also viewed" />
          </div>
        </div>
      </div>
    </PdpProvider>
  );
}

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

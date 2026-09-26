import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  getAllProducts,
  getCategories,
  getDeals,
  getProductsByCategory,
  getProductsWithBadge,
} from "@/lib/catalog";
import { COMMERCE } from "@/lib/commerce";
import { formatPriceShort } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { Hero } from "@/components/home/Hero";
import { CategoryMosaic, type MosaicTile } from "@/components/home/CategoryMosaic";
import { Shelf } from "@/components/home/Shelf";
import { RecentlyViewed } from "@/components/home/RecentlyViewed";
import { ProductCard } from "@/components/product/ProductCard";
import { ButtonLink } from "@/components/ui/Button";

/*
  The Kartly storefront.

  The replica homepage was ten modules of equal weight at a uniform 16px gap: a
  rotating hero, two four-up promo grids, a department grid and five boxed
  product rails. Nothing led, so nothing was read.

  This page has five sections with a deliberate order, and each one answers a
  different question:

    1. what is this shop            - hero
    2. where do I start             - departments
    3. what is worth buying         - the best-reviewed shelf
    4. what is cheap right now      - reduced, as a grid
    5. what if none of that suited  - a way out to search

  Every selection below is derived from the catalogue at request time and is
  deterministic: the same data produces the same page. Nothing is curated by
  hand, and there is no claim on this page that the data does not support.
*/

/** The most-reviewed product of a department stands in as its cover. */
function departmentCover(categoryId: string) {
  return (
    getProductsByCategory(categoryId).sort((a, b) => b.reviewCount - a.reviewCount)[0]?.image ?? null
  );
}

export default function Home() {
  const categories = getCategories();
  const catalog = getAllProducts();

  /*
    Departments are ranked by total review count across their products.

    Product count cannot rank them: the catalogue holds exactly twelve in every
    department, so sorting by size degenerates to a tiebreak and the "biggest"
    department would really just be the alphabetically first. Total reviews is a
    real signal of what shoppers engage with, it is deterministic, and it is
    already in the data.
  */
  const byCategory = categories
    .map((c) => {
      const products = getProductsByCategory(c.id);
      return {
        category: c,
        products,
        reviews: products.reduce((n, p) => n + p.reviewCount, 0),
      };
    })
    .sort((a, b) => b.reviews - a.reviews || a.category.id.localeCompare(b.category.id));

  /* One product from each of the three most-reviewed departments, taking the
     best-reviewed of each - three departments rather than three products from
     one, so the picture shows the breadth the copy claims. */
  const heroProducts = byCategory
    .slice(0, 3)
    .map(({ products }) => [...products].sort((a, b) => b.reviewCount - a.reviewCount)[0])
    .filter(Boolean);

  /* Most-reviewed first, so the two feature panels are earned rather than picked. */
  const tiles: MosaicTile[] = byCategory.map(({ category, products }) => ({
    id: category.id,
    name: category.name,
    blurb: category.blurb,
    count: products.length,
    image: departmentCover(category.id),
  }));

  /*
    Top rated: the highest-rated products that also have enough reviews for the
    rating to mean anything. A 5.0 from nine people is not a recommendation.
  */
  const reviewThreshold = 500;
  const topRated = [...catalog]
    .filter((p) => p.reviewCount >= reviewThreshold)
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, 12);

  /* Reduced: real discounts, deepest first. */
  const reduced = getDeals(10);

  /* Kartly's Choice, an existing badge in the catalogue. */
  const choice = getProductsWithBadge("choice", 12);

  return (
    <div className="shell pb-16">
      <Hero
        products={heroProducts}
        productCount={catalog.length}
        departmentCount={categories.length}
        freeShippingThreshold={COMMERCE.freeShippingThreshold}
      />

      <div className="flex flex-col gap-12 sm:gap-16">
        <CategoryMosaic tiles={tiles} />

        <Shelf
          title="Best reviewed"
          subtitle={`Rated highest by shoppers, counting only products with ${reviewThreshold}+ reviews.`}
          products={topRated}
          href="/s?sort=rating"
          hrefLabel="See all"
        />

        {reduced.length > 0 && (
          <section data-testid={TID.reducedSection} className="border-t border-line pt-6">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-display-md font-medium text-ink">Reduced this week</h2>
                <p className="mt-1 text-body text-ink-2">
                  Real reductions against the list price, deepest first.
                </p>
              </div>
              <Link
                href="/s?deals=1"
                className="hidden shrink-0 items-center gap-1 text-body font-medium text-brand hover:underline sm:inline-flex"
              >
                All offers
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {reduced.slice(0, 5).map((p) => (
                <li key={p.id} className="flex">
                  <ProductCard product={p} className="w-full" />
                </li>
              ))}
            </ul>
          </section>
        )}

        <Shelf
          title="Kartly&rsquo;s Choice"
          subtitle="Well rated, in stock, and priced sensibly against the alternatives."
          products={choice}
          href="/s?sort=rating"
        />

        <RecentlyViewed catalog={catalog} />

        {/* A way out, for anyone none of the above suited. */}
        <section className="rounded-[var(--radius-lg)] border border-line bg-surface px-6 py-12 text-center sm:px-10 sm:py-16">
          <h2 className="font-display text-display-md font-medium text-ink">
            Looking for something specific?
          </h2>
          <p className="mx-auto mt-2 max-w-[460px] text-body-lg text-ink-2">
            Search {catalog.length} products, or filter by department, brand, price and rating.
            Free delivery over {formatPriceShort(COMMERCE.freeShippingThreshold)}.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/s" variant="primary" size="lg">
              Browse all products
            </ButtonLink>
            <ButtonLink href="/browse" variant="outline" size="lg">
              Shop by department
            </ButtonLink>
          </div>
        </section>
      </div>
    </div>
  );
}

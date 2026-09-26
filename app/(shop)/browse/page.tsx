import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategories, getDeals, getBrands, getDepartmentStats } from "@/lib/data/products";
import { TID } from "@/lib/testids";
import { ProductCard } from "@/components/product/ProductCard";

export const metadata: Metadata = {
  title: "Browse",
  description: "Every Kartly department, the brands stocked in each, and what is reduced right now.",
};

/*
  Discovery landing page.

  Departments used to exist only inside a modal drawer, which meant the store's
  entire navigation had no address: it could not be linked to, shared, opened in
  a new tab or indexed. This is that destination, and it earns the visit rather
  than being a list of ten links.

  Three ways in, in descending order of how people actually shop:

    1. by department, with a real photograph and a real product count
    2. by brand, for someone who arrived knowing what they want
    3. by what is reduced, which is the only merchandising claim on the page

  Everything is derived from the catalogue at request time - counts, brands,
  representative imagery and the reduced products are all real. There is no
  invented statistic and no merchandising copy that the data does not support.
*/

export default async function BrowsePage() {
  /*
    Every figure below is a database read. Department counts and the brands
    stocked in each one are grouped queries rather than scans of a catalogue
    held in memory - see lib/data/products.ts - and the department cover is the
    most-reviewed product of that department, resolved in the same place.
  */
  const [departments, categories, brands, deals] = await Promise.all([
    getDepartmentStats(),
    getCategories(),
    getBrands(),
    getDeals(5),
  ]);
  const total = departments.reduce((n, d) => n + d.count, 0);

  return (
    <div className="shell py-8 sm:py-12">
      {/* intro ---------------------------------------------------------- */}
      <header className="max-w-[620px]">
        <p className="text-label font-semibold uppercase tracking-wide text-ink-3">Browse</p>
        <h1 className="mt-2 font-display text-display-lg font-medium leading-tight text-ink">
          Every department, end to end
        </h1>
        <p className="mt-3 text-body-lg text-ink-2">
          <span className="tnum font-medium text-ink">{total}</span> products across{" "}
          <span className="tnum font-medium text-ink">{departments.length}</span> departments and{" "}
          <span className="tnum font-medium text-ink">{brands.length}</span> brands. Start anywhere.
        </p>
      </header>

      {/* departments ---------------------------------------------------- */}
      <section className="mt-10 sm:mt-14" aria-labelledby="departments-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="departments-heading" className="font-display text-display-md font-medium text-ink">
            Departments
          </h2>
          <Link href="/s" className="shrink-0 text-body font-medium text-brand hover:underline">
            See all products
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {departments.map((d, i) => {
            const cover = d.image;
            return (
              <li key={d.id} className="flex">
                <Link
                  href={`/s?i=${d.id}`}
                  className="group flex w-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface transition-colors hover:border-line-strong"
                >
                  <span className="relative block aspect-[4/3] w-full overflow-hidden bg-surface-sunk">
                    {cover && (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 45vw, 240px"
                        priority={i < 5}
                        className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.04]"
                      />
                    )}
                  </span>
                  <span className="flex flex-1 flex-col p-3">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-ink transition-colors group-hover:text-brand">
                        {d.name}
                      </span>
                      <span className="tnum shrink-0 text-body-sm text-ink-3">{d.count}</span>
                    </span>
                    <span className="clamp-2 mt-[2px] text-body-sm text-ink-3">{d.blurb}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* brands --------------------------------------------------------- */}
      <section className="mt-12 sm:mt-16" aria-labelledby="brands-heading">
        <h2 id="brands-heading" className="mb-1 font-display text-display-md font-medium text-ink">
          Shop by brand
        </h2>
        <p className="mb-4 text-body text-ink-2">
          Every brand stocked on Kartly, with what each department carries.
        </p>

        <ul className="flex flex-wrap gap-2">
          {brands.map((brand) => (
            <li key={brand}>
              <Link
                href={`/s?brand=${encodeURIComponent(brand)}`}
                className="inline-flex h-10 items-center rounded-[var(--radius-btn)] border border-line-strong bg-surface px-4 text-body text-ink transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand"
              >
                {brand}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* department detail ---------------------------------------------- */}
      <section className="mt-12 sm:mt-16" aria-labelledby="inside-heading">
        <h2 id="inside-heading" className="mb-4 font-display text-display-md font-medium text-ink">
          What is in each department
        </h2>

        <ul className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <li key={d.id} className="border-t border-line pt-4">
              <h3 className="font-medium text-ink">
                <Link href={`/s?i=${d.id}`} className="transition-colors hover:text-brand">
                  {d.name}
                </Link>
              </h3>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {d.brands.map((brand) => (
                  <li key={brand}>
                    <Link
                      href={`/s?i=${d.id}&brand=${encodeURIComponent(brand)}`}
                      className="inline-block py-1 text-body-sm text-ink-2 underline-offset-2 hover:text-brand hover:underline"
                    >
                      {brand}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {/* reduced now ---------------------------------------------------- */}
      {deals.length > 0 && (
        <section className="mt-12 sm:mt-16" aria-labelledby="reduced-heading">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="reduced-heading" className="font-display text-display-md font-medium text-ink">
              Reduced right now
            </h2>
            <Link href="/s?deals=1" className="shrink-0 text-body font-medium text-brand hover:underline">
              All offers
            </Link>
          </div>

          <ul
            data-testid={TID.productGrid}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5"
          >
            {deals.map((p) => (
              <li key={p.id} className="flex">
                <ProductCard product={p} className="w-full" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* categories as a plain index, for anyone who just wants the list -- */}
      <nav className="mt-12 border-t border-line pt-6 sm:mt-16" aria-label="All departments">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/s?i=${c.id}`}
                className="inline-flex items-center gap-1 text-body-sm text-ink-2 transition-colors hover:text-brand"
              >
                {c.name}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

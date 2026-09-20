import Link from "next/link";
import Image from "next/image";
import { getBestSellers, getCategories, getDeals } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

/*
  TEMPORARY home page (still P0).

  It exists to exercise the chrome and the shared primitives across a realistic
  amount of content. The real homepage - hero carousel, category card rows,
  alternating product carousels - is P1 #13.
*/
export default function Home() {
  const categories = getCategories();
  const bestSellers = getBestSellers(6);
  const deals = getDeals(6);

  return (
    <div className="pb-10">
      <div className="shell space-y-4 pt-4">
        <section className="card p-5">
          <h1 className="text-[21px] font-bold">Shop every department</h1>
          <p className="mt-1 text-[13px] text-muted">
            120 products across {categories.length} departments. Browse as a guest &mdash; no account needed.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c, i) => (
              <Link key={c.id} href={`/s?i=${c.id}`} className="group">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[4px] bg-white">
                  {c.image && (
                    <Image
                      src={c.image}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 45vw, 200px"
                      className="object-contain"
                      priority={i < 5}
                    />
                  )}
                </div>
                <p className="mt-2 text-[13px] font-bold text-ink group-hover:text-link-hover group-hover:underline">
                  {c.name}
                </p>
                <p className="clamp-1 text-[12px] text-muted">{c.blurb}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <SectionHeader title="Best Sellers" actionLabel="See all" actionHref="/s" className="mb-4" />
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {bestSellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        <section className="card p-5">
          <SectionHeader title="Today's Deals" subtitle="Limited time offers" actionLabel="See all deals" actionHref="/s?deals=1" className="mb-4" />
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {deals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

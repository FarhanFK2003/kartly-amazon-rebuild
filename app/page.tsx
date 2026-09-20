import Image from "next/image";
import { getBestSellers, getCategories, getDeals } from "@/lib/catalog";
import { splitPrice, deliveryDate } from "@/lib/utils";
import type { Product } from "@/lib/types";

/*
  TEMPORARY foundation check (P0 #1-2).

  This page exists to prove the toolchain, design tokens, catalog data and local
  product imagery all work together. It is replaced by the real homepage at
  P1 #13, once the header, search, PDP and cart are built.
*/

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)));
        return (
          <span key={i} className="relative block h-[15px] w-[15px]">
            <span className="absolute inset-0 text-line" aria-hidden>
              <Star />
            </span>
            <span
              className="absolute inset-0 overflow-hidden text-star"
              style={{ width: `${fill * 100}%` }}
              aria-hidden
            >
              <Star />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[15px] w-[15px]">
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

function Price({ cents }: { cents: number }) {
  const { symbol, whole, fraction } = splitPrice(cents);
  return (
    <span className="text-ink">
      <span className="relative -top-[0.5em] text-[13px]">{symbol}</span>
      <span className="text-[28px] leading-none font-medium">{whole}</span>
      <span className="relative -top-[0.5em] text-[13px]">{fraction}</span>
    </span>
  );
}

function ProductCard({ product }: { product: Product }) {
  const delivery = deliveryDate(product.deliveryDays);
  return (
    <div className="card flex flex-col p-4">
      <div className="relative mb-3 aspect-square w-full bg-white">
        {product.image && (
          <Image
            src={product.image}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 50vw, 240px"
            className="object-contain"
          />
        )}
      </div>

      {product.badges.includes("bestSeller") && (
        <span className="mb-1 w-fit bg-[#cc6600] px-2 py-[2px] text-[11px] font-bold text-white">
          Best Seller
        </span>
      )}
      {product.badges.includes("choice") && (
        <span className="mb-1 w-fit bg-subnav px-2 py-[2px] text-[11px] font-bold text-white">
          Kartly&apos;s Choice
        </span>
      )}

      <p className="clamp-2 text-[14px] leading-5 text-link">{product.title}</p>

      <div className="mt-1 flex items-center gap-1">
        <Stars rating={product.rating} />
        <span className="text-[12px] text-link">
          {product.reviewCount.toLocaleString("en-US")}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        {product.dealPercent > 0 && (
          <span className="rounded-[4px] bg-deal px-[6px] py-[1px] text-[12px] font-bold text-white">
            -{product.dealPercent}%
          </span>
        )}
        <Price cents={product.price} />
      </div>

      {product.listPrice && (
        <p className="text-[12px] text-muted">
          List: <span className="line-through">${(product.listPrice / 100).toFixed(2)}</span>
        </p>
      )}

      <p className="mt-1 text-[12px] text-muted">
        FREE delivery <span className="font-bold text-ink">{delivery.short}</span>
      </p>

      {product.stock <= 9 && (
        <p className="mt-1 text-[12px] text-deal">Only {product.stock} left in stock.</p>
      )}
    </div>
  );
}

export default function Home() {
  const categories = getCategories();
  const bestSellers = getBestSellers(6);
  const deals = getDeals(6);

  return (
    <main className="min-h-screen pb-16">
      <header className="bg-header text-white">
        <div className="shell flex h-[60px] items-center gap-6">
          <span className="text-[26px] font-bold tracking-tight">
            kartly<span className="text-brand">.</span>
          </span>
          <span className="text-[13px] text-white/70">
            Foundation check &mdash; P0 #1 (toolchain + tokens) and #2 (catalog)
          </span>
        </div>
      </header>

      <div className="bg-subnav text-white">
        <div className="shell flex h-[39px] items-center gap-5 overflow-x-auto text-[14px] no-scrollbar">
          {categories.map((c) => (
            <span key={c.id} className="whitespace-nowrap">
              {c.name}
            </span>
          ))}
        </div>
      </div>

      <div className="shell mt-4 space-y-4">
        <section className="card p-5">
          <h1 className="text-[21px] font-bold">Catalog loaded</h1>
          <p className="mt-1 text-muted">
            {categories.length} departments &middot;{" "}
            {bestSellers.length > 0 ? "120 products" : "no products"} &middot; images served from{" "}
            <code>/public/products</code>
          </p>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-[21px] font-bold">Best Sellers</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {bestSellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-[21px] font-bold">Today&apos;s Deals</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {deals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

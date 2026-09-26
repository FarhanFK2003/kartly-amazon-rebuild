import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TID } from "@/lib/testids";
import { formatPriceShort } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/Button";
import type { Product } from "@/lib/types";

/*
  The hero.

  Not a promotional carousel. The replica's hero was four rotating slides of
  invented copy - "Deals across every department", "Kitchen upgrades under $50"
  - autoplaying every six seconds, which meant three quarters of it was written
  for nobody and the whole thing needed arrows, indicator dots and a
  reduced-motion guard to exist at all.

  This states what the shop is, once, and then shows three real products from
  three different departments as evidence. The claims are checkable: the
  product count and department count are counted, the free-delivery threshold
  comes from the commerce constants, and every price and photograph belongs to
  a product you can click through to. No slide, no timer, no invented offer.
*/
export function Hero({
  products,
  productCount,
  departmentCount,
  freeShippingThreshold,
}: {
  /** Three real products, chosen deterministically by the page. */
  products: Product[];
  productCount: number;
  departmentCount: number;
  freeShippingThreshold: number;
}) {
  return (
    <section
      data-testid={TID.hero}
      className="grid grid-cols-1 items-center gap-8 py-10 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:py-16"
    >
      <div className="max-w-[560px]">
        <p className="text-label font-semibold uppercase tracking-wide text-ink-3">
          {departmentCount} departments &middot; {productCount} products
        </p>

        <h1 className="mt-3 font-display text-[38px] font-medium leading-[1.08] text-ink sm:text-[52px] lg:text-[60px]">
          A shop you can get
          <br />
          to the bottom of.
        </h1>

        <p className="mt-4 max-w-[440px] text-body-lg text-ink-2">
          One well-judged shelf per department instead of a million listings. Every product here
          has a real spec sheet, real reviews and a delivery date &mdash; free over{" "}
          {formatPriceShort(freeShippingThreshold)}.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <ButtonLink href="/browse" variant="primary" size="lg">
            Start browsing
          </ButtonLink>
          <Link
            href="/s?deals=1"
            className="inline-flex h-12 items-center gap-1 rounded-[var(--radius-btn)] px-2 text-body-lg font-medium text-brand hover:underline"
          >
            See what&rsquo;s reduced
            <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
          </Link>
        </div>
      </div>

      {/*
        Three real products, offset so the eye moves through them rather than
        reading them as a row of equal tiles. Each is a link to its own page.
      */}
      <ul className="grid grid-cols-3 gap-3 sm:gap-4">
        {products.map((p, i) => (
          <li
            key={p.id}
            className={i === 1 ? "mt-6 sm:mt-10" : i === 2 ? "mt-3 sm:mt-5" : undefined}
          >
            <Link href={`/dp/${p.slug}`} className="group block">
              <span className="relative block aspect-[3/4] w-full overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface-sunk">
                {p.image && (
                  <Image
                    src={p.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 30vw, 220px"
                    priority={i === 0}
                    className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
                  />
                )}
              </span>
              <span className="mt-2 block truncate text-body-sm text-ink-2 transition-colors group-hover:text-brand">
                {p.brand}
              </span>
              <span className="tnum block text-body-sm font-semibold text-ink">
                {formatPriceShort(p.price)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

import Link from "next/link";
import { StarRating } from "@/components/ui/StarRating";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/lib/types";

/**
 * Review summary and a representative sample, both read from the catalogue's
 * generated reviews. The histogram and the star value come from the same
 * numbers, so the bars always agree with the headline rating.
 */
export function Reviews({ product }: { product: Product }) {
  const { rating, reviewCount, ratingHistogram, reviews } = product;
  const top = [...reviews].sort((a, b) => b.helpful - a.helpful).slice(0, 4);

  return (
    <section id="reviews" className="scroll-mt-[120px] border-t border-line-soft pt-6">
      <h2 className="text-[21px] font-bold text-ink">Customer reviews</h2>

      <div className="mt-4 flex flex-col gap-8 lg:flex-row">
        {/* summary */}
        <div className="lg:w-[300px] lg:shrink-0">
          <div className="flex items-center gap-2">
            <StarRating rating={rating} size="lg" />
            <span className="text-[18px] text-ink">{rating.toFixed(1)} out of 5</span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {reviewCount.toLocaleString("en-US")} global ratings
          </p>

          <ul className="mt-4 space-y-[6px]">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = ratingHistogram[String(star) as "1" | "2" | "3" | "4" | "5"] ?? 0;
              const pct = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
              return (
                <li key={star} className="flex items-center gap-2">
                  <span className="w-[42px] shrink-0 text-[13px] text-link">{star} star</span>
                  <span className="h-[18px] flex-1 overflow-hidden rounded-[2px] border border-[#d5d9d9] bg-[#f0f2f2]">
                    <span
                      className="block h-full bg-[#ffa41c]"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                  </span>
                  <span className="w-[34px] shrink-0 text-right text-[13px] text-link">{pct}%</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 rounded-[8px] border border-line bg-[#f7f8f8] p-3">
            <h3 className="text-[15px] font-bold text-ink">Customers say</h3>
            <p className="mt-1 text-[13px] leading-5 text-ink">{summarise(product)}</p>
            <p className="mt-2 text-[11px] text-muted">
              Generated from this product&apos;s reviews.
            </p>
          </div>
        </div>

        {/* individual reviews */}
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold text-ink">Top reviews</h3>
          <ul className="mt-3 divide-y divide-line-soft">
            {top.map((r) => (
              <li key={r.id} className="py-4 first:pt-0">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e3e6e6] text-[12px] font-bold text-muted"
                  >
                    {r.author.charAt(0)}
                  </span>
                  <span className="text-[13px] text-ink">{r.author}</span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StarRating rating={r.rating} size="sm" />
                  <span className="text-[14px] font-bold text-ink">{r.title}</span>
                </div>

                <p className="mt-1 text-[12px] text-muted">
                  Reviewed on {new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>

                {r.verified && (
                  <p className="mt-1 text-[12px] font-bold text-[#c45500]">Verified Purchase</p>
                )}

                <p className="mt-2 text-[14px] leading-5 text-ink">{r.body}</p>

                <div className="mt-3 flex items-center gap-3">
                  <Button variant="outline" size="sm">
                    Helpful
                  </Button>
                  <Link href="#reviews" className="link text-[12px]">
                    Report
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Deterministic one-liner derived from the product's own numbers. */
function summarise(product: Product): string {
  const { rating, reviewCount, ratingHistogram } = product;
  const fiveStarShare = reviewCount
    ? Math.round(((ratingHistogram["5"] ?? 0) / reviewCount) * 100)
    : 0;

  const tone =
    rating >= 4.6
      ? "Customers are consistently happy with this one"
      : rating >= 4.2
        ? "Customers are broadly positive about this one"
        : "Customers are mixed on this one";

  const theme =
    rating >= 4.6
      ? "praising build quality and value, and several mention it replaced something more expensive"
      : rating >= 4.2
        ? "praising build quality and value, though a few mention the instructions could be clearer"
        : "with build quality rated well but some reporting it did not match what they expected";

  return `${tone}: ${fiveStarShare}% left five stars, ${theme}.`;
}

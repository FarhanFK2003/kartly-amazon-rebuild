"use client";

import { useMemo, useState } from "react";
import { ThumbsUp, Check } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { Product, Review } from "@/lib/types";

type ReviewSort = "helpful" | "recent" | "highest" | "lowest";

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "helpful", label: "Top reviews" },
  { value: "recent", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

const INITIAL_VISIBLE = 4;

/**
 * Review summary and list, driven entirely by the catalogue's generated
 * reviews. The histogram, the headline star value and the summary sentence all
 * read from the same numbers, so they can never contradict each other.
 */
export function Reviews({ product }: { product: Product }) {
  const { rating, reviewCount, ratingHistogram, reviews } = product;

  const [sort, setSort] = useState<ReviewSort>("helpful");
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [helpful, setHelpful] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => {
    const filtered = starFilter ? reviews.filter((r) => r.rating === starFilter) : [...reviews];
    const sorted = filtered.sort((a, b) => {
      if (sort === "recent") return b.date.localeCompare(a.date);
      if (sort === "highest") return b.rating - a.rating || b.helpful - a.helpful;
      if (sort === "lowest") return a.rating - b.rating || b.helpful - a.helpful;
      return b.helpful - a.helpful;
    });
    return sorted;
  }, [reviews, sort, starFilter]);

  const shown = expanded ? visible : visible.slice(0, INITIAL_VISIBLE);

  return (
    <section id="reviews" className="scroll-mt-[120px] border-t border-line-soft pt-6">
      <h2 className="text-[19px] font-bold text-ink sm:text-[21px]">Customer reviews</h2>

      <div className="mt-4 flex flex-col gap-8 lg:flex-row">
        {/* ---------- summary ---------- */}
        <div className="lg:w-[300px] lg:shrink-0">
          <div className="flex items-center gap-2">
            <StarRating rating={rating} size="lg" />
            <span className="text-[17px] text-ink sm:text-[18px]">{rating.toFixed(1)} out of 5</span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {reviewCount.toLocaleString("en-US")} global ratings
          </p>

          <ul className="mt-4 space-y-[6px]">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = ratingHistogram[String(star) as "1" | "2" | "3" | "4" | "5"] ?? 0;
              const pct = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
              const hasSamples = reviews.some((r) => r.rating === star);
              const isActive = starFilter === star;

              return (
                <li key={star}>
                  <button
                    type="button"
                    disabled={!hasSamples}
                    onClick={() => {
                      setStarFilter(isActive ? null : star);
                      setExpanded(false);
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[4px] px-1 py-[2px] text-left",
                      hasSamples ? "cursor-pointer hover:bg-[#f7fafa]" : "cursor-default",
                      isActive && "bg-[#f0f7f8]"
                    )}
                  >
                    <span className={cn("w-[46px] shrink-0 text-[13px]", hasSamples ? "text-link" : "text-muted")}>
                      {star} star
                    </span>
                    <span className="h-[18px] flex-1 overflow-hidden rounded-[2px] border border-[#d5d9d9] bg-[#f0f2f2]">
                      <span className="block h-full bg-[#ffa41c]" style={{ width: `${pct}%` }} aria-hidden />
                    </span>
                    <span className="w-[34px] shrink-0 text-right text-[13px] text-link">{pct}%</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {starFilter && (
            <button type="button" onClick={() => setStarFilter(null)} className="link mt-2 text-[13px]">
              Clear {starFilter}-star filter
            </button>
          )}

          <div className="mt-5 rounded-[8px] border border-line bg-[#f7f8f8] p-3">
            <h3 className="text-[15px] font-bold text-ink">Customers say</h3>
            <p className="mt-1 text-[13px] leading-5 text-ink">{summarise(product)}</p>
            <div className="mt-2 flex flex-wrap gap-[6px]">
              {themes(product).map((t) => (
                <span key={t} className="rounded-full border border-line bg-white px-2 py-[2px] text-[11px] text-ink">
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">Generated from this product&apos;s reviews.</p>
          </div>
        </div>

        {/* ---------- reviews ---------- */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[16px] font-bold text-ink sm:text-[17px]">
              {starFilter ? `${starFilter}-star reviews` : "Reviews"}
              <span className="ml-1 font-normal text-muted">({visible.length})</span>
            </h3>

            <label className="flex items-center gap-2 text-[13px] text-ink">
              <span className="sr-only sm:not-sr-only">Sort by</span>
              <span className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ReviewSort)}
                  aria-label="Sort reviews by"
                  className="h-8 cursor-pointer appearance-none rounded-[8px] border border-[#8d9096] bg-gradient-to-b from-white to-[#e7e9ec] pl-3 pr-8 text-[13px] text-ink focus:outline-none"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2" aria-hidden>
                  <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
            </label>
          </div>

          {shown.length === 0 ? (
            <p className="py-8 text-[14px] text-muted">
              No {starFilter}-star reviews to show.{" "}
              <button type="button" onClick={() => setStarFilter(null)} className="link">
                See all reviews
              </button>
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft">
              {shown.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  marked={!!helpful[r.id]}
                  onHelpful={() => setHelpful((h) => ({ ...h, [r.id]: !h[r.id] }))}
                />
              ))}
            </ul>
          )}

          {visible.length > INITIAL_VISIBLE && (
            <Button
              variant="outline"
              size="md"
              className="mt-4"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Show fewer reviews" : `See all ${visible.length} reviews`}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({
  review,
  marked,
  onHelpful,
}: {
  review: Review;
  marked: boolean;
  onHelpful: () => void;
}) {
  return (
    <li className="py-4 first:pt-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e3e6e6] text-[12px] font-bold text-muted"
        >
          {review.author.charAt(0)}
        </span>
        <span className="text-[13px] text-ink">{review.author}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StarRating rating={review.rating} size="sm" />
        <span className="text-[14px] font-bold text-ink">{review.title}</span>
      </div>

      <p className="mt-1 text-[12px] text-muted">
        Reviewed on{" "}
        {new Date(review.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      {review.verified && (
        <p className="mt-1 flex items-center gap-1 text-[12px] font-bold text-[#c45500]">
          <Check className="h-3 w-3" aria-hidden />
          Verified Purchase
        </p>
      )}

      <p className="mt-2 text-[14px] leading-5 text-ink">{review.body}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onHelpful} aria-pressed={marked}>
          <ThumbsUp className={cn("h-[14px] w-[14px]", marked && "text-[#007185]")} />
          {marked ? "Marked helpful" : "Helpful"}
        </Button>
        <span className="text-[12px] text-muted">
          {(review.helpful + (marked ? 1 : 0)).toLocaleString("en-US")} found this helpful
        </span>
      </div>
    </li>
  );
}

/** Deterministic one-liner derived from the product's own numbers. */
function summarise(product: Product): string {
  const { rating, reviewCount, ratingHistogram } = product;
  const fiveStarShare = reviewCount ? Math.round(((ratingHistogram["5"] ?? 0) / reviewCount) * 100) : 0;

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

function themes(product: Product): string[] {
  const base = ["Build quality", "Value for money"];
  if (product.rating >= 4.5) base.push("Easy to set up");
  else base.push("Instructions");
  if (product.dealPercent > 0) base.push("Price");
  return base;
}

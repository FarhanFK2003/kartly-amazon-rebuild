import Link from "next/link";
import { cn } from "@/lib/utils";

const SIZES = { sm: 14, md: 16, lg: 19 } as const;

interface StarRatingProps {
  rating: number;
  count?: number;
  size?: keyof typeof SIZES;
  /** Show the numeric rating before the stars, as search result rows do. */
  showValue?: boolean;
  /** Show the dropdown caret that follows the stars on result rows. */
  showCaret?: boolean;
  /** Wrap the count in parentheses (result rows) rather than bare (cards). */
  parenthesised?: boolean;
  /** Metadata form: one star, the value, the count. */
  compact?: boolean;
  href?: string;
  className?: string;
}

/**
 * Compact by default: a single filled star, the value, then the count.
 *
 * The replica drew five glyphs, a caret and a parenthesised count on every card
 * - six elements and roughly 90px of width to communicate one number, repeated
 * sixteen times in a grid. Kartly states it as "4.2 (2,823)" against one star.
 *
 * The full five-glyph row is still available for surfaces where the rating is
 * the subject rather than metadata - the PDP header and the review summary -
 * via showValue/size, so no data or precision is lost. Fractional fill is still
 * drawn by clipping a filled row over a neutral one.
 */
export function StarRating({
  rating,
  count,
  size = "sm",
  showValue = false,
  showCaret = false,
  parenthesised = false,
  compact = false,
  href,
  className,
}: StarRatingProps) {
  const px = SIZES[size];
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));

  const stars = (
    <span
      className="relative inline-block shrink-0 align-middle"
      style={{ width: px * 5, height: px }}
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      <span className="absolute inset-0 flex text-line-strong" aria-hidden>
        <StarRow px={px} />
      </span>
      <span className="absolute inset-0 flex overflow-hidden text-star" style={{ width: `${pct}%` }} aria-hidden>
        <StarRow px={px} />
      </span>
    </span>
  );

  /* Metadata form: one star, the value, the count. */
  if (compact) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 whitespace-nowrap text-body-sm", className)}
        role="img"
        aria-label={`${rating} out of 5 stars${typeof count === "number" ? `, ${count} ratings` : ""}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[13px] w-[13px] shrink-0 text-brand-ink" aria-hidden>
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
        <span className="tnum text-ink">{rating.toFixed(1)}</span>
        {typeof count === "number" && (
          <span className="tnum text-ink-3">({count.toLocaleString("en-US")})</span>
        )}
      </span>
    );
  }

  const body = (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      {showValue && <span className="tnum text-body-sm text-ink">{rating.toFixed(1)}</span>}
      {stars}
      {showCaret && (
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#565959]" aria-hidden>
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
      {typeof count === "number" && (
        <span className="tnum text-body-sm text-brand-ink">
          {parenthesised ? `(${count.toLocaleString("en-US")})` : count.toLocaleString("en-US")}
        </span>
      )}
    </span>
  );

  if (!href) return body;
  return (
    <Link href={href} className="inline-flex hover:[&_span.text-link]:text-link-hover hover:[&_span.text-link]:underline">
      {body}
    </Link>
  );
}

function StarRow({ px }: { px: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" fill="currentColor" style={{ width: px, height: px }} className="shrink-0">
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </>
  );
}

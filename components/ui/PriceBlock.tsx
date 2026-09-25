import { cn, formatPrice } from "@/lib/utils";

/*
  Prices are set plainly, in tabular lining figures.

  The raised currency symbol with oversized whole number and raised decimals is
  the single most recognisable typographic signature of the marketplace this
  project was replicating. Kartly states the price instead: one size, one
  weight, digits in a fixed column so a value does not reflow as it changes.
  splitPrice() stays exported for any caller that still wants the parts;
  nothing in the new system uses it.
*/
const SIZES = {
  xs: "text-body-sm font-semibold",
  sm: "text-body-lg font-semibold",
  md: "text-display-sm font-semibold",
  lg: "text-display-md font-semibold",
} as const;

interface PriceBlockProps {
  cents: number;
  listPrice?: number | null;
  dealPercent?: number;
  size?: keyof typeof SIZES;
  /** Shipping cost shown under the price, as result rows do. */
  deliveryCents?: number | null;
  /** Test-id from lib/testids, so QA can tell one money figure from another. */
  testId?: string;
  className?: string;
}

/**
 * Every price in the application renders through this component, so money
 * cannot be formatted one way on a card and another in a total.
 *
 * The redesign changed only presentation. The props, the discount semantics and
 * the values themselves are untouched.
 */
export function PriceBlock({
  cents,
  listPrice,
  dealPercent = 0,
  size = "md",
  deliveryCents,
  testId,
  className,
}: PriceBlockProps) {
  const s = SIZES[size];
  const showList = typeof listPrice === "number" && listPrice > cents;

  return (
    <div className={cn("text-ink", className)} data-testid={testId}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("tnum leading-tight tracking-tight", s)}>{formatPrice(cents)}</span>
        {showList && (
          <span className="tnum text-body-sm text-ink-3 line-through">{formatPrice(listPrice!)}</span>
        )}
        {dealPercent > 0 && (
          <span className="rounded-[var(--radius-sm)] bg-accent-tint px-[6px] py-[1px] text-label font-semibold text-accent">
            &minus;{dealPercent}%
          </span>
        )}
      </div>

      {typeof deliveryCents === "number" && deliveryCents > 0 && (
        <p className="tnum mt-[2px] text-body-sm text-ink-2">{formatPrice(deliveryCents)} delivery</p>
      )}
    </div>
  );
}

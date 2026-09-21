import { cn, splitPrice, formatPrice } from "@/lib/utils";

/*
  The symbol and the decimals are raised by being small text top-aligned inside
  a tall line box - that alone is the effect. They used to carry an extra
  negative offset of about 0.6em on top of that, which lifted the "$" a further
  8px and left it floating clear above the digits instead of sitting against
  them. Measured against the reference, the symbol's top sits at or just below
  the top of the whole number, so the offset is gone and only the alignment
  does the work.
*/
const SIZES = {
  xs: { whole: "text-[15px]", small: "text-[10px]" },
  sm: { whole: "text-[18px]", small: "text-[11px]" },
  md: { whole: "text-[21px]", small: "text-[12px]" },
  lg: { whole: "text-[28px]", small: "text-[13px]" },
} as const;

interface PriceBlockProps {
  cents: number;
  listPrice?: number | null;
  dealPercent?: number;
  size?: keyof typeof SIZES;
  /** Shipping cost shown under the price, as result rows do. */
  deliveryCents?: number | null;
  className?: string;
}

/**
 * The raised currency symbol, oversized whole number and raised decimals are the
 * most recognisable typographic signature of a marketplace listing. Every price
 * in the app renders through this component so it is impossible to get wrong in
 * one place and right in another.
 */
export function PriceBlock({
  cents,
  listPrice,
  dealPercent = 0,
  size = "md",
  deliveryCents,
  className,
}: PriceBlockProps) {
  const { symbol, whole, fraction } = splitPrice(cents);
  const s = SIZES[size];
  const showList = typeof listPrice === "number" && listPrice > cents;

  return (
    <div className={cn("text-ink", className)}>
      <div className="flex flex-wrap items-center gap-x-2">
        {dealPercent > 0 && (
          <span className="rounded-[4px] bg-deal px-[6px] py-[2px] text-[12px] font-bold leading-4 text-white">
            -{dealPercent}%
          </span>
        )}
        <span className="inline-flex items-start leading-none">
          <span className={cn(s.small)}>{symbol}</span>
          <span className={cn("font-medium leading-none tracking-tight", s.whole)}>{whole}</span>
          <span className={cn(s.small)}>{fraction}</span>
        </span>
      </div>

      {showList && (
        <p className="mt-[2px] text-[12px] text-muted">
          List: <span className="line-through">{formatPrice(listPrice!)}</span>
        </p>
      )}

      {typeof deliveryCents === "number" && deliveryCents > 0 && (
        <p className="mt-[2px] text-[12px] text-muted">{formatPrice(deliveryCents)} delivery</p>
      )}
    </div>
  );
}

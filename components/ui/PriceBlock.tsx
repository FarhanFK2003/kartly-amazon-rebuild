import { cn, splitPrice, formatPrice } from "@/lib/utils";

const SIZES = {
  xs: { whole: "text-[15px]", small: "text-[10px]", top: "-top-[0.45em]" },
  sm: { whole: "text-[18px]", small: "text-[11px]", top: "-top-[0.5em]" },
  md: { whole: "text-[21px]", small: "text-[12px]", top: "-top-[0.55em]" },
  lg: { whole: "text-[28px]", small: "text-[13px]", top: "-top-[0.6em]" },
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
          <span className={cn("relative", s.small, s.top)}>{symbol}</span>
          <span className={cn("font-medium leading-none tracking-tight", s.whole)}>{whole}</span>
          <span className={cn("relative", s.small, s.top)}>{fraction}</span>
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

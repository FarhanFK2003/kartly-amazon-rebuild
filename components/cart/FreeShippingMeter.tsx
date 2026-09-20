import { Truck } from "lucide-react";
import { COMMERCE } from "@/lib/commerce";
import { formatPrice } from "@/lib/utils";

/**
 * Subtle progress toward the free-shipping threshold. The threshold comes from
 * COMMERCE, so the copy and the bar both move together if it changes.
 */
export function FreeShippingMeter({
  subtotal,
  remaining,
  qualified,
}: {
  subtotal: number;
  remaining: number;
  qualified: boolean;
}) {
  const pct = Math.min(100, Math.round((subtotal / COMMERCE.freeShippingThreshold) * 100));

  return (
    <div className="rounded-[8px] border border-line-soft bg-[#f7f8f8] px-3 py-[10px]">
      <p className="flex items-start gap-2 text-[13px] leading-[18px]">
        <Truck className={`mt-[2px] h-4 w-4 shrink-0 ${qualified ? "text-success" : "text-muted"}`} />
        {qualified ? (
          <span className="text-ink">
            Your order qualifies for <span className="font-bold text-success">FREE Shipping</span>.
          </span>
        ) : (
          <span className="text-ink">
            Add <span className="font-bold">{formatPrice(remaining)}</span> of eligible items to
            qualify for <span className="font-bold">FREE Shipping</span>.
          </span>
        )}
      </p>

      <div
        className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-[#e3e6e6]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress toward free shipping"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${qualified ? "bg-success" : "bg-[#ffa41c]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

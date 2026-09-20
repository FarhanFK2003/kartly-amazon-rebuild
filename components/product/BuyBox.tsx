"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { DeliveryPromise } from "@/components/ui/Badge";
import { useCart } from "@/lib/store/cart";
import { usePdp } from "@/components/product/PdpContext";
import { deliveryDate } from "@/lib/utils";

/**
 * The buy box is the commercial centre of the page: price, promise, stock and
 * the two CTAs, boxed and separated from the description so it reads as the
 * place where the decision happens.
 */
export function BuyBox() {
  const { product, variant, qty, setQty, effectivePrice } = usePdp();
  const add = useCart((s) => s.add);
  const router = useRouter();
  const [added, setAdded] = useState(false);

  const inStock = product.stock > 0;
  const fastest = deliveryDate(Math.max(1, product.deliveryDays - 1));

  function addToCart() {
    add(product.id, qty, variant?.id ?? null);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  function buyNow() {
    add(product.id, qty, variant?.id ?? null);
    // Checkout is P0 #8; until then Buy Now hands off to the cart, which is the
    // next step of the same flow.
    router.push("/cart");
  }

  return (
    <div className="rounded-[8px] border border-line bg-white p-4">
      <PriceBlock
        cents={effectivePrice}
        listPrice={product.listPrice}
        dealPercent={product.dealPercent}
        size="lg"
      />

      <div className="mt-3 space-y-1">
        <DeliveryPromise days={product.deliveryDays} />
        <p className="text-[13px] text-muted">
          Or fastest delivery <span className="font-bold text-ink">{fastest.long}</span>
        </p>
      </div>

      <p className={`mt-3 text-[18px] ${inStock ? "text-success" : "text-deal"}`}>
        {inStock ? "In Stock" : "Currently unavailable"}
      </p>
      {inStock && product.stock <= 9 && (
        <p className="text-[13px] text-deal">Only {product.stock} left in stock - order soon.</p>
      )}

      {inStock && (
        <>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
            <span>Qty:</span>
            {/* The select is appearance:none, so it needs its own caret or it
                reads as a plain text box rather than a dropdown. */}
            <span className="relative inline-block">
              <Select
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                aria-label="Quantity"
                className="w-[76px] rounded-[8px] pr-7"
              >
                {Array.from({ length: Math.min(10, product.stock) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
              <svg
                viewBox="0 0 12 12"
                className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-ink"
                aria-hidden
              >
                <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </label>

          <div className="mt-4 space-y-2">
            <Button variant="primary" size="lg" fullWidth onClick={addToCart}>
              {added ? (
                <>
                  <Check className="h-4 w-4" /> Added to cart
                </>
              ) : (
                "Add to Cart"
              )}
            </Button>
            <Button variant="secondary" size="lg" fullWidth onClick={buyNow}>
              Buy Now
            </Button>
          </div>
        </>
      )}

      <p className="mt-4 flex items-center justify-center gap-1 text-[12px] text-link">
        <Lock className="h-3 w-3" /> Secure transaction
      </p>

      <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Ships from</dt>
          <dd className="text-ink">Kartly</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Sold by</dt>
          <dd className="text-ink">Kartly</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Returns</dt>
          <dd className="text-ink">30-day refund</dd>
        </div>
      </dl>
    </div>
  );
}

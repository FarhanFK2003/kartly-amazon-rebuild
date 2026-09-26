"use client";

import { useRouter } from "next/navigation";
import { Check, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { TID } from "@/lib/testids";
import { COMMERCE } from "@/lib/commerce";
import { useCart } from "@/lib/store/cart";
import { useCartDrawer } from "@/lib/store/cartDrawer";
import { usePdp } from "@/components/product/PdpContext";
import { deliveryDate, formatPriceShort } from "@/lib/utils";

/**
 * The decision.
 *
 * Not a box. The replica pinned a bordered panel to the right edge with a
 * yellow and an orange call to action stacked inside it, a lock icon, and a
 * three-row seller table - a dense utility block competing with the product
 * for attention. This is the same information, unboxed, in the reading order
 * of the decision itself: what it costs, whether it is available, when it
 * arrives, which one, how many, and then the two actions.
 *
 * The behaviour is unchanged from the version it replaces. Add to cart writes
 * to the same store and opens the same mini-cart; Buy now adds and routes to
 * the cart rather than jumping to payment, so nobody commits to something they
 * have not seen. Quantity still caps at ten or the stock on hand, whichever is
 * lower. No commerce logic lives here - the delivery threshold comes from the
 * commerce constants, not a second copy of the number.
 */
export function BuyBox({ children }: { children?: React.ReactNode }) {
  const { product, variant, qty, setQty, effectivePrice } = usePdp();
  const add = useCart((s) => s.add);
  const openDrawer = useCartDrawer((s) => s.openDrawer);
  const router = useRouter();

  const inStock = product.stock > 0;
  const maxQty = Math.max(1, Math.min(10, product.stock));
  const arrives = deliveryDate(product.deliveryDays);
  const fastest = deliveryDate(Math.max(1, product.deliveryDays - 1));
  const qualifiesForFreeShipping = effectivePrice * qty >= COMMERCE.freeShippingThreshold;

  function addToCart() {
    add(product.id, qty, variant?.id ?? null);
    openDrawer(product.id);
  }

  function buyNow() {
    add(product.id, qty, variant?.id ?? null);
    // Routes through the cart rather than straight to payment, so the shopper
    // sees what they are about to buy before committing.
    router.push("/cart");
  }

  return (
    <div className="mt-6 border-t border-line pt-6">
      <PriceBlock
        cents={effectivePrice}
        listPrice={product.listPrice}
        dealPercent={product.dealPercent}
        size="lg"
        testId={TID.pdpPrice}
      />

      <p className="mt-2 flex items-center gap-[6px] text-body">
        {inStock ? (
          <>
            <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
            <span className="font-medium text-success">In stock</span>
          </>
        ) : (
          <span className="font-medium text-accent">Currently unavailable</span>
        )}
      </p>

      {/* Variant selection, passed in so the picker keeps its own component. */}
      {children}

      {inStock && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 text-body text-ink-2">
              <span>Quantity</span>
              <QuantityStepper
                value={qty}
                onChange={setQty}
                min={1}
                max={maxQty}
                testId={TID.pdpQuantity}
              />
            </label>
            {product.stock <= 3 && (
              <span className="tnum text-body-sm text-accent">Only {product.stock} left</span>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="primary"
              size="lg"
              onClick={addToCart}
              data-testid={TID.pdpAddToCart}
              className="flex-1"
            >
              Add to cart
            </Button>
            <Button variant="outline" size="lg" onClick={buyNow} className="flex-1">
              Buy now
            </Button>
          </div>
        </>
      )}

      {/* Delivery and policy, stated once and quietly. */}
      <ul className="mt-7 flex flex-col gap-3 border-t border-line pt-6 text-body-sm text-ink-2">
        <li className="flex gap-3">
          <Truck className="mt-[2px] h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} aria-hidden />
          <span>
            Arrives <span className="font-medium text-ink">{arrives.long}</span>, or{" "}
            {fastest.long} at the fastest.{" "}
            {qualifiesForFreeShipping ? (
              <span className="font-medium text-success">Delivery is free on this order.</span>
            ) : (
              <>Free over {formatPriceShort(COMMERCE.freeShippingThreshold)}.</>
            )}
          </span>
        </li>
        <li className="flex gap-3">
          <RotateCcw className="mt-[2px] h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} aria-hidden />
          <span>30-day returns, free of charge.</span>
        </li>
        <li className="flex gap-3">
          <ShieldCheck className="mt-[2px] h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.8} aria-hidden />
          <span>Sold and shipped by Kartly. This is a demo store &mdash; no payment is taken.</span>
        </li>
      </ul>
    </div>
  );
}

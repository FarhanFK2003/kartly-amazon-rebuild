"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart, useIsMounted } from "@/lib/store/cart";
import { computeTotals, resolveLines, type CartIndex } from "@/lib/commerce";
import { formatPrice, pluralize } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CartLineRow } from "@/components/cart/CartLine";
import { FreeShippingMeter } from "@/components/cart/FreeShippingMeter";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";

/**
 * The cart is entirely client-side: it lives in localStorage so the store works
 * signed out. The server hands down a compact product index because it cannot
 * know what is in the cart.
 */
export function CartView({ index, recommended }: { index: CartIndex; recommended: Product[] }) {
  const mounted = useIsMounted();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);

  const resolved = resolveLines(lines, index);
  const active = resolved.filter((r) => !r.line.saved);
  const saved = resolved.filter((r) => r.line.saved);
  const totals = computeTotals(resolved);

  // Until the persisted cart is read back, render the same empty shell the
  // server produced rather than risking a hydration mismatch.
  if (!mounted) {
    return <div className="shell py-10" aria-busy="true" />;
  }

  if (active.length === 0 && saved.length === 0) {
    return <EmptyCart recommended={recommended} />;
  }

  return (
    <div className="shell py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* main column */}
        <div className="min-w-0 flex-1">
          <div className="card px-4 py-4 sm:px-6">
            <div className="flex items-end justify-between border-b border-line-soft pb-3">
              <h1 className="text-[28px] font-normal leading-9 text-ink">Shopping Cart</h1>
              <span className="hidden text-[13px] text-muted sm:block">Price</span>
            </div>

            {active.length === 0 ? (
              <p className="py-6 text-[14px] text-muted">
                Your cart is empty, but you have {saved.length} {pluralize(saved.length, "item")} saved
                for later.
              </p>
            ) : (
              <div className="divide-y divide-line-soft">
                {active.map((r) => (
                  <CartLineRow key={`${r.line.productId}-${r.line.variantId ?? "base"}`} resolved={r} />
                ))}
              </div>
            )}

            <div className="border-t border-line-soft pt-3 text-right">
              <p className="text-[17px] text-ink">
                Subtotal ({totals.itemCount} {pluralize(totals.itemCount, "item")}):{" "}
                <span className="font-bold">{formatPrice(totals.subtotal)}</span>
              </p>
            </div>
          </div>

          {saved.length > 0 && (
            <div className="card mt-4 px-4 py-4 sm:px-6">
              <h2 className="border-b border-line-soft pb-3 text-[21px] font-bold text-ink">
                Saved for later ({saved.length})
              </h2>
              <div className="divide-y divide-line-soft">
                {saved.map((r) => (
                  <CartLineRow
                    key={`saved-${r.line.productId}-${r.line.variantId ?? "base"}`}
                    resolved={r}
                    saved
                  />
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 px-1 text-[12px] leading-4 text-muted">
            Kartly is a demo storefront. Prices and availability are illustrative, nothing is for
            sale, and no payment is ever taken.
          </p>
        </div>

        {/* summary rail */}
        <aside className="w-full lg:sticky lg:top-[115px] lg:w-[300px] lg:shrink-0">
          <div className="card p-4">
            <FreeShippingMeter
              subtotal={totals.subtotal}
              remaining={totals.remainingForFreeShipping}
              qualified={totals.freeShipping}
            />

            <p className="mt-3 text-[18px] text-ink">
              Subtotal ({totals.itemCount} {pluralize(totals.itemCount, "item")}):{" "}
              <span className="font-bold">{formatPrice(totals.subtotal)}</span>
            </p>

            <Checkbox id="gift" label="This order contains a gift" className="mt-3" />

            <ButtonLink
              href="/checkout"
              variant="primary"
              size="lg"
              fullWidth
              className="mt-4"
              aria-disabled={totals.itemCount === 0}
            >
              Proceed to checkout
            </ButtonLink>

            <ButtonLink href="/s" variant="outline" size="md" fullWidth className="mt-2">
              Continue shopping
            </ButtonLink>

            {active.length > 0 && (
              <Button
                variant="subtle"
                size="sm"
                fullWidth
                className="mt-2"
                onClick={() => {
                  if (window.confirm("Remove all items from your cart?")) clear();
                }}
              >
                Clear cart
              </Button>
            )}
          </div>
        </aside>
      </div>

      {recommended.length > 0 && (
        <section className="card mt-4 p-4 sm:p-5">
          <SectionHeader title="Recommended for you" size="md" className="mb-4" />
          <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
            {recommended.map((p) => (
              <div key={p.id} className="w-[160px] shrink-0 sm:w-[190px]">
                <ProductCard product={p} variant="grid" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyCart({ recommended }: { recommended: Product[] }) {
  return (
    <div className="shell py-4">
      <div className="card flex flex-col items-center gap-5 px-6 py-12 text-center sm:flex-row sm:text-left">
        <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full bg-[#f3f4f4]">
          <ShoppingCart className="h-14 w-14 text-[#b9bdbd]" strokeWidth={1.4} />
        </div>
        <div>
          <h1 className="text-[24px] font-bold text-ink">Your Kartly cart is empty</h1>
          <p className="mt-2 max-w-[460px] text-[14px] text-muted">
            Nothing here yet. Browse the departments or search for something specific, and anything
            you add will stay in your cart on this device.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <ButtonLink href="/s" variant="primary" size="md">
              Continue shopping
            </ButtonLink>
            <Link href="/" className="link text-[14px]">
              Go to the homepage
            </Link>
          </div>
        </div>
      </div>

      {recommended.length > 0 && (
        <section className="card mt-4 p-4 sm:p-5">
          <SectionHeader title="Top picks to get you started" size="md" className="mb-4" />
          <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
            {recommended.map((p) => (
              <div key={p.id} className="w-[160px] shrink-0 sm:w-[190px]">
                <ProductCard product={p} variant="grid" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

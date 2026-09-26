"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart, useIsMounted, type CartSnapshot } from "@/lib/store/cart";
import { computeTotals, resolveLines } from "@/lib/commerce";
import { formatPrice, pluralize } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { CartLineRow } from "@/components/cart/CartLine";
import { FreeShippingMeter } from "@/components/cart/FreeShippingMeter";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";

/**
 * The cart.
 *
 * Entirely client-side: it lives in localStorage so the store works signed
 * out, and the server hands down a compact product index because it cannot
 * know what is in the cart. That is unchanged.
 *
 * What changed is that the summary now states the whole cost rather than only
 * a subtotal. The replica cart showed one number and left shipping and tax to
 * appear for the first time at checkout, which is the moment a shopper least
 * wants a surprise. Every figure here comes from computeTotals - there is no
 * second pricing formula in this file.
 */
export function CartView({
  recommended,
  initial,
}: {
  recommended: Product[];
  initial: CartSnapshot;
}) {
  const mounted = useIsMounted();
  const clear = useCart((s) => s.clear);

  /*
    Server-rendered cart for the first paint, store-owned thereafter.

    `ready` flips once the client has its own copy, so there is no window in
    which this renders an empty cart it does not have. The store is not seeded
    directly because it is module scope - on the server that is shared between
    requests, and one shopper's cart must never appear in another's response.
  */
  const ready = useCart((s) => s.ready);
  const storeLines = useCart((s) => s.lines);
  const storeIndex = useCart((s) => s.index);
  const lines = ready ? storeLines : initial.lines;
  const index = ready ? storeIndex : initial.index;
  const resolved = resolveLines(lines, index);
  const active = resolved.filter((r) => !r.line.saved);
  const saved = resolved.filter((r) => r.line.saved);
  const totals = computeTotals(resolved);

  // Until the persisted cart is read back, render the shell the server
  // produced rather than risking a hydration mismatch.
  if (!mounted) {
    return <div className="shell py-16" aria-busy="true" />;
  }

  if (active.length === 0 && saved.length === 0) {
    return <EmptyCart recommended={recommended} />;
  }

  return (
    <div className="shell py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="font-display text-display-lg font-medium text-ink">Your cart</h1>
        <p className="tnum mt-1 text-body text-ink-2">
          {totals.itemCount} {pluralize(totals.itemCount, "item")}
          {saved.length > 0 && <> &middot; {saved.length} saved for later</>}
        </p>
      </header>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
        <div className="min-w-0 flex-1">
          {active.length === 0 ? (
            <p className="border-t border-line py-8 text-body text-ink-2">
              Nothing in the cart right now &mdash; but you have {saved.length}{" "}
              {pluralize(saved.length, "item")} saved below.
            </p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {active.map((r) => (
                <CartLineRow
                  key={`${r.line.productId}-${r.line.variantId ?? "base"}`}
                  resolved={r}
                />
              ))}
            </ul>
          )}

          {active.length > 0 && (
            <div className="flex justify-end border-t border-line py-4">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  if (window.confirm("Remove all items from your cart?")) clear();
                }}
              >
                Clear cart
              </Button>
            </div>
          )}

          {saved.length > 0 && (
            <section className="mt-10" aria-labelledby="saved-heading">
              <h2 id="saved-heading" className="font-display text-display-sm font-medium text-ink">
                Saved for later
              </h2>
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {saved.map((r) => (
                  <CartLineRow
                    key={`saved-${r.line.productId}-${r.line.variantId ?? "base"}`}
                    resolved={r}
                    saved
                  />
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* summary --------------------------------------------------- */}
        <aside className="w-full lg:sticky lg:top-[80px] lg:w-[340px] lg:shrink-0">
          <div className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
            <h2 className="font-display text-display-sm font-medium text-ink">Order summary</h2>

            <dl className="mt-4 flex flex-col gap-[10px] text-body">
              <Row label={`Items (${totals.itemCount})`} value={formatPrice(totals.subtotal)} testId={TID.cartSubtotal} />
              <Row
                label="Shipping"
                value={totals.freeShipping ? "Free" : formatPrice(totals.shipping)}
                highlight={totals.freeShipping}
              />
              <Row label="Estimated tax" value={formatPrice(totals.tax)} />
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="text-body-lg font-medium text-ink">Total</dt>
                <dd className="tnum text-display-sm font-semibold text-ink" data-testid={TID.cartTotal}>
                  {formatPrice(totals.total)}
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              <FreeShippingMeter
                subtotal={totals.subtotal}
                remaining={totals.remainingForFreeShipping}
                qualified={totals.freeShipping}
              />
            </div>

            <Checkbox id="gift" label="This order contains a gift" className="mt-4" />

            <ButtonLink
              href="/checkout"
              variant="primary"
              size="lg"
              fullWidth
              className="mt-5"
              aria-disabled={totals.itemCount === 0}
            >
              Checkout
            </ButtonLink>

            <Link
              href="/s"
              className="mt-3 block text-center text-body-sm font-medium text-brand hover:underline"
            >
              Continue shopping
            </Link>
          </div>

          <p className="mt-4 px-1 text-body-sm leading-[19px] text-ink-3">
            Kartly is a demo storefront. Nothing is for sale and no payment is ever taken.
          </p>
        </aside>
      </div>

      {recommended.length > 0 && (
        <section className="mt-16 border-t border-line pt-6" aria-labelledby="recommended-heading">
          <h2 id="recommended-heading" className="mb-5 font-display text-display-md font-medium text-ink">
            You might also like
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {recommended.slice(0, 5).map((p) => (
              <li key={p.id} className="flex">
                <ProductCard product={p} className="w-full" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  testId,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd
        data-testid={testId}
        className={highlight ? "font-medium text-success" : "tnum text-ink"}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyCart({ recommended }: { recommended: Product[] }) {
  return (
    <div className="shell py-12 sm:py-20">
      <div className="mx-auto max-w-[520px] text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-surface-sunk">
          <ShoppingBag className="h-9 w-9 text-ink-3" strokeWidth={1.4} aria-hidden />
        </div>
        <h1 className="mt-6 font-display text-display-lg font-medium text-ink">Your cart is empty</h1>
        <p className="mt-3 text-body-lg text-ink-2">
          Nothing here yet. Anything you add stays in your cart on this device, signed in or not.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/browse" variant="primary" size="lg">
            Shop by department
          </ButtonLink>
          <ButtonLink href="/s" variant="outline" size="lg">
            Browse all products
          </ButtonLink>
        </div>
      </div>

      {recommended.length > 0 && (
        <section className="mt-16 border-t border-line pt-6" aria-labelledby="starters-heading">
          <h2 id="starters-heading" className="mb-5 font-display text-display-md font-medium text-ink">
            Popular right now
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {recommended.slice(0, 5).map((p) => (
              <li key={p.id} className="flex">
                <ProductCard product={p} className="w-full" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

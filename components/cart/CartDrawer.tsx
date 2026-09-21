"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { X, ShoppingCart, Check } from "lucide-react";
import { cn, formatPrice, pluralize } from "@/lib/utils";
import { computeTotals, resolveLines, type CartIndex } from "@/lib/commerce";
import { useCart, useIsMounted } from "@/lib/store/cart";
import { useCartDrawer } from "@/lib/store/cartDrawer";
import { Button, ButtonLink } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { FreeShippingMeter } from "@/components/cart/FreeShippingMeter";

/**
 * The mini-cart.
 *
 * Rendered once by SiteHeader and opened by every add-to-cart control through a
 * shared store, exactly as the department drawer works - so there is one dialog
 * in the accessibility tree rather than one per button.
 *
 * It reads the same cart store and the same resolveLines/computeTotals as the
 * full cart page, which is what stops the drawer and /cart from ever disagreeing
 * about a subtotal. The drawer owns no cart logic of its own; it is a view.
 *
 * Modal semantics match the department drawer: aria-modal, focus moved in,
 * Tab cycled within, Escape and scrim to dismiss, focus restored on close, and
 * visibility transitioned alongside the transform so the panel leaves the tab
 * order when it is parked off-canvas.
 */
export function CartDrawer({ index }: { index: CartIndex }) {
  const open = useCartDrawer((s) => s.open);
  const close = useCartDrawer((s) => s.closeDrawer);
  const highlightId = useCartDrawer((s) => s.highlightId);

  const mounted = useIsMounted();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  const resolved = resolveLines(lines, index).filter((r) => !r.line.saved);
  const totals = computeTotals(resolved);

  /* focus management, body lock, Escape - mirrors DepartmentDrawer */
  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 60);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, close]);

  // Following a link out of the drawer must not leave it hanging over the page.
  useEffect(() => {
    close();
  }, [pathname, close]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/60 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={close}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal={open || undefined}
        aria-label="Shopping cart"
        aria-hidden={!open || undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-[61] flex w-[92vw] max-w-[380px] flex-col bg-white",
          "transition-[transform,visibility] duration-200 ease-out sm:max-w-[400px]",
          open ? "visible translate-x-0" : "invisible translate-x-full"
        )}
      >
        {/* Matching the department drawer's 54px dark strip keeps the two
            panels reading as the same component from opposite edges. */}
        <div className="flex h-[54px] shrink-0 items-center justify-between bg-subnav pl-5 pr-2 text-white">
          <span className="flex items-center gap-2 truncate text-[17px] font-bold">
            <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={2} />
            {mounted && totals.itemCount > 0
              ? `${totals.itemCount} ${pluralize(totals.itemCount, "item")}`
              : "Your cart"}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="rounded p-2 transition-colors hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {resolved.length === 0 ? (
          <EmptyState onClose={close} />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ul className="divide-y divide-line-soft px-4">
                {resolved.map((r) => {
                  const key = `${r.line.productId}-${r.line.variantId ?? "base"}`;
                  return (
                    <li key={key} className="flex gap-3 py-3">
                      <Link
                        href={`/dp/${r.product.slug}`}
                        className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-[4px] border border-line-soft bg-white"
                      >
                        {r.product.image && (
                          <Image
                            src={r.product.image}
                            alt=""
                            fill
                            sizes="68px"
                            className="object-contain p-1"
                          />
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dp/${r.product.slug}`}
                          className="clamp-2 text-[13px] leading-[17px] text-ink hover:text-link-hover hover:underline"
                        >
                          {r.product.title}
                        </Link>
                        {r.variantLabel && (
                          <p className="mt-[2px] text-[12px] text-muted">{r.variantLabel}</p>
                        )}

                        {/* The just-added marker is a line of text rather than a
                            motion effect, so it is legible to a screen reader
                            and invisible to anyone who was not looking for it. */}
                        {highlightId === r.product.id && (
                          <p className="mt-[2px] flex items-center gap-1 text-[12px] font-medium text-success">
                            <Check className="h-[13px] w-[13px]" strokeWidth={2.5} />
                            Added
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <QuantityStepper
                            size="sm"
                            value={r.line.qty}
                            max={Math.max(1, Math.min(30, r.product.stock))}
                            onChange={(next) => setQty(r.line.productId, r.line.variantId, next)}
                            onRemove={() => remove(r.line.productId, r.line.variantId)}
                          />
                          <PriceBlock cents={r.lineTotal} size="xs" />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="shrink-0 border-t border-line bg-white p-4">
              <FreeShippingMeter
                subtotal={totals.subtotal}
                remaining={totals.remainingForFreeShipping}
                qualified={totals.freeShipping}
              />

              <p className="mt-3 flex items-baseline justify-between text-[15px] text-ink">
                <span>Subtotal</span>
                <span className="text-[18px] font-bold">{formatPrice(totals.subtotal)}</span>
              </p>

              <ButtonLink href="/cart" variant="primary" size="lg" fullWidth className="mt-3">
                Go to Cart
              </ButtonLink>
              <Button variant="subtle" size="md" fullWidth className="mt-2" onClick={close}>
                Continue shopping
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#f3f4f4]">
        <ShoppingCart className="h-10 w-10 text-[#b9bdbd]" strokeWidth={1.4} />
      </div>
      <p className="mt-4 text-[16px] font-bold text-ink">Your cart is empty</p>
      <p className="mt-1 text-[13px] text-muted">
        Anything you add stays in your cart on this device.
      </p>
      <Button variant="primary" size="md" className="mt-5" onClick={onClose}>
        Continue shopping
      </Button>
    </div>
  );
}

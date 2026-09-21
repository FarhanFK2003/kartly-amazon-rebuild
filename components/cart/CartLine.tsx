"use client";

import Image from "next/image";
import Link from "next/link";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { StarRating } from "@/components/ui/StarRating";
import { DeliveryPromise } from "@/components/ui/Badge";
import { useCart } from "@/lib/store/cart";
import { COMMERCE, type ResolvedLine } from "@/lib/commerce";

/**
 * One cart row. Quantity is clamped to the product's stock so the cart can
 * never promise more than exists, and stepping below one removes the line via
 * the stepper's delete affordance.
 */
export function CartLineRow({ resolved, saved = false }: { resolved: ResolvedLine; saved?: boolean }) {
  const { line, product, variantLabel, unitPrice } = resolved;
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const toggleSaved = useCart((s) => s.toggleSaved);

  const maxQty = Math.max(1, Math.min(COMMERCE.maxLineQty, product.stock));
  const inStock = product.stock > 0;

  return (
    <div className="flex gap-3 py-4 sm:gap-4">
      <Link href={`/dp/${product.slug}`} className="shrink-0">
        <div className="relative h-[110px] w-[110px] overflow-hidden rounded-[4px] bg-white sm:h-[150px] sm:w-[150px]">
          {product.image && (
            <Image src={product.image} alt={product.title} fill sizes="150px" className="object-contain" />
          )}
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <Link
              href={`/dp/${product.slug}`}
              className="clamp-2 text-[15px] leading-5 text-ink hover:text-link-hover hover:underline sm:text-[17px] sm:leading-6"
            >
              {product.title}
            </Link>

            <div className="mt-1 hidden sm:block">
              <StarRating rating={product.rating} count={product.reviewCount} size="sm" />
            </div>

            {variantLabel && (
              <p className="mt-1 text-[13px] text-muted">
                <span className="font-bold text-ink">Option:</span> {variantLabel}
              </p>
            )}

            <p className={`mt-1 text-[13px] ${inStock ? "text-success" : "text-deal"}`}>
              {inStock ? "In Stock" : "Currently unavailable"}
            </p>

            {!saved && <DeliveryPromise days={product.deliveryDays} className="mt-[2px]" />}

            {inStock && product.stock <= 9 && (
              <p className="mt-[2px] text-[12px] text-deal">Only {product.stock} left in stock.</p>
            )}
          </div>

          {/* price column, right-aligned on desktop as in the reference */}
          <div className="shrink-0 sm:text-right">
            <PriceBlock cents={unitPrice} size="md" className="sm:flex sm:justify-end" />
            {line.qty > 1 && (
              <p className="mt-[2px] text-[12px] text-muted">
                {line.qty} &times; {(unitPrice / 100).toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* actions */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {!saved && (
            <QuantityStepper
              value={line.qty}
              min={1}
              max={maxQty}
              onChange={(next) => setQty(line.productId, line.variantId, next)}
              onRemove={() => remove(line.productId, line.variantId)}
              size="sm"
            />
          )}

          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />

          <button
            type="button"
            onClick={() => remove(line.productId, line.variantId)}
            className="link text-[13px]"
          >
            Delete
          </button>

          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />

          <button
            type="button"
            onClick={() => toggleSaved(line.productId, line.variantId)}
            className="link text-[13px]"
          >
            {saved ? "Move to cart" : "Save for later"}
          </button>
        </div>
      </div>
    </div>
  );
}

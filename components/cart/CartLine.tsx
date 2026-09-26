"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useCart } from "@/lib/store/cart";
import { COMMERCE, type ResolvedLine } from "@/lib/commerce";
import { formatPrice } from "@/lib/utils";
import { TID } from "@/lib/testids";

/**
 * One cart row.
 *
 * Deliberately not a ProductCard. A card is for choosing between products; a
 * cart row is for adjusting something already chosen, so it reads left to
 * right - what it is, how many, what that costs - rather than top to bottom.
 *
 * The replica row carried a rating, a stock line, a delivery promise and three
 * text links under every item. None of that helps someone who has already
 * decided; the rating in particular is an invitation to reconsider at the
 * moment of paying. What remains is the product, the option chosen, the
 * quantity, the line total, and one way to remove it.
 *
 * Quantity is clamped to the product's stock so the cart can never promise
 * more than exists, and stepping below one removes the line through the
 * stepper's delete affordance - both unchanged.
 */
export function CartLineRow({ resolved, saved = false }: { resolved: ResolvedLine; saved?: boolean }) {
  const { line, product, variantLabel, unitPrice, lineTotal } = resolved;
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const toggleSaved = useCart((s) => s.toggleSaved);

  const maxQty = Math.max(1, Math.min(COMMERCE.maxLineQty, product.stock));

  return (
    <li data-testid={TID.cartLine} className="flex gap-4 py-5">
      <Link
        href={`/dp/${product.slug}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface-sunk sm:h-24 sm:w-24"
      >
        {product.image && (
          <Image src={product.image} alt="" fill sizes="96px" className="object-cover" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/dp/${product.slug}`}
              data-testid={TID.cartLineTitle}
              className="clamp-2 text-body font-medium leading-[20px] text-ink transition-colors hover:text-brand"
            >
              {product.title}
            </Link>

            {/* The cart index carries only what the cart needs - no brand field,
                and widening it would mean changing protected commerce code for
                a line of metadata. */}
            {variantLabel && <p className="mt-1 text-body-sm text-ink-3">{variantLabel}</p>}

            {product.stock <= 0 && (
              <p className="mt-1 text-body-sm font-medium text-accent">Currently unavailable</p>
            )}
          </div>

          <p
            data-testid={TID.cartLineTotal}
            className="tnum shrink-0 text-body font-semibold text-ink"
          >
            {formatPrice(lineTotal)}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {saved ? (
            <button
              type="button"
              onClick={() => toggleSaved(line.productId, line.variantId)}
              className="h-9 rounded-[var(--radius-btn)] border border-line-strong bg-surface px-3 text-body-sm font-medium text-ink transition-colors hover:bg-surface-sunk"
            >
              Move to cart
            </button>
          ) : (
            <>
              <QuantityStepper
                value={line.qty}
                min={1}
                max={maxQty}
                onChange={(next) => setQty(line.productId, line.variantId, next)}
                onRemove={() => remove(line.productId, line.variantId)}
                size="sm"
                testId={TID.cartLineQuantity}
              />

              {/* Unit price only matters once there is more than one. */}
              {line.qty > 1 && (
                <span className="tnum text-body-sm text-ink-3">{formatPrice(unitPrice)} each</span>
              )}

              <button
                type="button"
                onClick={() => toggleSaved(line.productId, line.variantId)}
                className="text-body-sm text-ink-2 underline-offset-2 transition-colors hover:text-brand hover:underline"
              >
                Save for later
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => remove(line.productId, line.variantId)}
            aria-label={`Remove ${product.title} from cart`}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-ink-3 transition-colors hover:bg-surface-sunk hover:text-accent"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </li>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { Button, type ButtonSize } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useCart, useIsMounted } from "@/lib/store/cart";

interface AddToCartButtonProps {
  productId: string;
  variantId?: string | null;
  qty?: number;
  size?: ButtonSize;
  outOfStock?: boolean;
  maxQty?: number;
  label?: string;
  className?: string;
}

/**
 * Listing surfaces carry their own add-to-cart, which is what the reference does
 * and what keeps a demo walkthrough to one click per item.
 *
 * Once the product is in the cart the control becomes a quantity stepper
 * reading "N in cart", as the reference does. That replaces the old approach -
 * a green "Added" flash that timed out after 1400ms and reverted to "Add to
 * cart", leaving the card looking exactly like one that had never been touched.
 * The stepper is a better confirmation precisely because it does not expire:
 * a shopper scanning back up a results page can still see what they picked, and
 * can change their mind without going to the cart.
 *
 * This one deliberately does not open the mini-cart. A quick add from a grid is
 * a glance-and-move-on action; the buy box and frequently-bought-together open
 * it because those are deliberate, one-at-a-time adds.
 */
export function AddToCartButton({
  productId,
  variantId = null,
  qty = 1,
  size = "sm",
  outOfStock = false,
  maxQty = 30,
  label = "Add to cart",
  className,
}: AddToCartButtonProps) {
  const mounted = useIsMounted();
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  // Only the active line counts: something saved for later is out of the cart,
  // so the control has to offer to add it again rather than to change it.
  const inCart = useCart(
    (s) =>
      s.lines.find(
        (l) =>
          l.productId === productId && (l.variantId ?? null) === (variantId ?? null) && !l.saved
      )?.qty ?? 0
  );

  if (outOfStock) {
    return (
      <Button variant="outline" size={size} disabled className={className}>
        Currently unavailable
      </Button>
    );
  }

  // The cart is read from localStorage, so it cannot be known during the server
  // render. Showing the plain button until mount keeps the markup identical
  // across hydration.
  if (mounted && inCart > 0) {
    return (
      <QuantityStepper
        value={inCart}
        label={`${inCart} in cart`}
        size={size === "lg" ? "md" : "sm"}
        max={maxQty}
        // Keeps the yellow of the CTA it replaced, so an added card still reads
        // as acted on from across the grid. A grey stepper made a card that had
        // been added look quieter than one that had not.
        className={cn("border-cta-border", className)}
        onChange={(next) => setQty(productId, variantId, next)}
        onRemove={() => remove(productId, variantId)}
      />
    );
  }

  return (
    <Button
      variant="primary"
      size={size}
      className={className}
      onClick={() => add(productId, qty, variantId)}
    >
      {label}
    </Button>
  );
}

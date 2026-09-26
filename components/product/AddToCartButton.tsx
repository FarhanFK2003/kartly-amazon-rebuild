"use client";

import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { Button, type ButtonSize } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useCart, useIsMounted } from "@/lib/store/cart";
import { useCartDrawer } from "@/lib/store/cartDrawer";

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
 * Adding opens the mini-cart here too, as the reference does. That is only
 * workable because the panel is not modal - it leaves the grid clickable, so
 * the next add needs nothing dismissed first.
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
  const openDrawer = useCartDrawer((s) => s.openDrawer);
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

  // The cart is owned by the server and fetched after mount, so it cannot be
  // known during the server render. Showing the plain button until mount keeps
  // the markup identical across hydration.
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
        className={cn("border-brand", className)}
        testId={TID.cartQtyStepper}
        onChange={(next) => setQty(productId, variantId, next)}
        onRemove={() => remove(productId, variantId)}
      />
    );
  }

  /*
    Disabled until React has attached its handlers.

    Pages are server-rendered per request, so the button is painted and
    clickable for a moment before hydration - and a click in that window was
    silently dropped, which is the worst possible outcome: the shopper believes
    they added something and nothing happened. Marking the control busy until
    mount turns that into an honest "not yet" instead of a lost click, and it
    costs nothing once hydrated.

    It also removes the race from automation: Playwright waits for a control to
    be enabled before clicking it, so tests no longer have to guess.
  */
  return (
    <Button
      variant="primary"
      size={size}
      className={className}
      data-testid={TID.addToCart}
      disabled={!mounted}
      aria-busy={!mounted || undefined}
      onClick={() => {
        add(productId, qty, variantId);
        openDrawer(productId);
      }}
    >
      {label}
    </Button>
  );
}

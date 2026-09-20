"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button, type ButtonSize } from "@/components/ui/Button";
import { useCart } from "@/lib/store/cart";

interface AddToCartButtonProps {
  productId: string;
  variantId?: string | null;
  qty?: number;
  size?: ButtonSize;
  outOfStock?: boolean;
  label?: string;
  className?: string;
}

/**
 * Listing surfaces carry their own add-to-cart, which is what the reference does
 * and what keeps a demo walkthrough to one click per item. The brief confirmation
 * flash is deliberate: shoppers need to see that the click landed without being
 * navigated away from the results they are still scanning.
 */
export function AddToCartButton({
  productId,
  variantId = null,
  qty = 1,
  size = "sm",
  outOfStock = false,
  label = "Add to cart",
  className,
}: AddToCartButtonProps) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const [, startTransition] = useTransition();

  if (outOfStock) {
    return (
      <Button variant="outline" size={size} disabled className={className}>
        Currently unavailable
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      size={size}
      className={className}
      onClick={() => {
        add(productId, qty, variantId);
        setAdded(true);
        startTransition(() => {
          window.setTimeout(() => setAdded(false), 1400);
        });
      }}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" />
          Added
        </>
      ) : (
        label
      )}
    </Button>
  );
}

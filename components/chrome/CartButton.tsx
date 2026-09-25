"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { TID } from "@/lib/testids";
import { useHydratedCartCount } from "@/lib/store/cart";

/**
 * Cart control.
 *
 * The count is a small brand-filled badge at the icon's top-right, replacing
 * the orange numeral that sat over the middle of the trolley - legible only
 * because it was the one warm colour on a dark bar, and unreadable on a light
 * one.
 *
 * Reads 0 on the server and on first paint, then swaps to the persisted value
 * once the store rehydrates, so the markup is identical across hydration.
 *
 * When the count rises the badge gives one short nudge. Deliberately almost
 * nothing - a 10% scale for 220ms - because it fires on every add, and anything
 * with bounce in it is irritating by the third item.
 */
export function CartButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const count = useHydratedCartCount();
  const capped = count > 99 ? "99+" : String(count);

  const [bumped, setBumped] = useState(false);
  const previous = useRef(count);

  useEffect(() => {
    if (count > previous.current) {
      setBumped(true);
      const t = window.setTimeout(() => setBumped(false), 220);
      previous.current = count;
      return () => window.clearTimeout(t);
    }
    previous.current = count;
  }, [count]);

  return (
    <Link
      href="/cart"
      data-testid={TID.cartLink}
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-sm)] text-ink transition-colors hover:bg-surface-sunk",
        compact ? "h-10 w-10 justify-center" : "h-9 px-3",
        className
      )}
    >
      <span className="relative">
        <ShoppingCart className={compact ? "h-5 w-5" : "h-[20px] w-[20px]"} strokeWidth={1.9} aria-hidden />
        {count > 0 && (
          <span
            className={cn(
              "tnum absolute -right-[7px] -top-[6px] min-w-[16px] rounded-full bg-brand px-1",
              "text-center text-[10px] font-semibold leading-[16px] text-white",
              "motion-safe:transition-transform motion-safe:duration-200",
              bumped && "motion-safe:scale-110"
            )}
          >
            {capped}
          </span>
        )}
      </span>
      {!compact && <span className="text-body font-medium">Cart</span>}
    </Link>
  );
}

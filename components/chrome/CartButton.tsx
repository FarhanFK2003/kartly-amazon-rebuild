"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydratedCartCount } from "@/lib/store/cart";
import { HEADER_HOVER_BOX } from "@/components/chrome/styles";

/**
 * Live cart count. Reads 0 on the server and on first paint, then swaps to the
 * persisted value once the store rehydrates, which keeps the markup identical
 * across the hydration boundary.
 *
 * When the count goes up the badge gives one short nudge. It is deliberately
 * almost nothing - a 10% scale for 220ms - because this fires on every add, and
 * anything with bounce or travel in it becomes irritating by the third item.
 * It is also the only confirmation a shopper gets when they add from a listing
 * without opening the drawer, so it cannot be nothing at all.
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
      className={cn(HEADER_HOVER_BOX, "group relative flex items-end gap-1", className)}
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <span className="relative">
        <ShoppingCart className={cn("text-white", compact ? "h-7 w-7" : "h-[30px] w-[30px]")} strokeWidth={1.6} />
        <span
          className={cn(
            "absolute left-1/2 -translate-x-[35%] font-bold text-brand",
            "motion-safe:transition-transform motion-safe:duration-200",
            bumped && "motion-safe:scale-110",
            compact ? "-top-[6px] text-[13px]" : "-top-[7px] text-[15px]"
          )}
        >
          {capped}
        </span>
      </span>
      {!compact && <span className="text-[14px] font-bold leading-4 text-white">Cart</span>}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydratedCartCount } from "@/lib/store/cart";

/**
 * Live cart count. Reads 0 on the server and on first paint, then swaps to the
 * persisted value once the store rehydrates, which keeps the markup identical
 * across the hydration boundary.
 */
export function CartButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const count = useHydratedCartCount();
  const capped = count > 99 ? "99+" : String(count);

  return (
    <Link
      href="/cart"
      className={cn(
        "group relative flex items-end gap-1 rounded-[2px] border border-transparent px-2 py-1 hover:border-white",
        className
      )}
      aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <span className="relative">
        <ShoppingCart className={cn("text-white", compact ? "h-7 w-7" : "h-[30px] w-[30px]")} strokeWidth={1.6} />
        <span
          className={cn(
            "absolute left-1/2 -translate-x-[35%] font-bold text-brand",
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

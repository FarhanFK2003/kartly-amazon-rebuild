"use client";

import { useIsMounted } from "@/lib/store/cart";
import { useRecentlyViewed } from "@/lib/store/recentlyViewed";
import { Shelf } from "@/components/ui/Shelf";
import type { ProductCardData } from "@/lib/types";

/**
 * Renders nothing until something has actually been viewed, so a first-time
 * visitor never sees an empty shelf. Ids come from localStorage and are joined
 * against the catalogue the server already sent.
 */
export function RecentlyViewed({ catalog }: { catalog: ProductCardData[] }) {
  const mounted = useIsMounted();
  const ids = useRecentlyViewed((s) => s.ids);

  if (!mounted || ids.length === 0) return null;

  const products = ids
    .map((id) => catalog.find((p) => p.id === id))
    .filter((p): p is ProductCardData => Boolean(p));

  if (products.length === 0) return null;

  return (
    <Shelf
      title="Recently viewed"
      subtitle="Pick up where you left off."
      products={products}
      showCta={false}
    />
  );
}

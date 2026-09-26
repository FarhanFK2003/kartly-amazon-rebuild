"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/store/cart";

/**
 * Loads the server-owned cart once, on the client, after mount.
 *
 * The cart lives in PostgreSQL behind an HttpOnly session cookie, so the very
 * first paint cannot know it - rendering it server-side would also make every
 * page in the group uncacheable on the cart's behalf. One request after mount
 * is the smaller cost, and the badge is already written to show nothing until
 * mounted, so there is no flash and no hydration mismatch.
 */
export function CartSync() {
  const hydrate = useCart((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return null;
}

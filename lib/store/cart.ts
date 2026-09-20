"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartLine {
  productId: string;
  variantId: string | null;
  qty: number;
  /** Moved out of the active cart but kept on the cart page. */
  saved: boolean;
}

interface CartState {
  lines: CartLine[];
  add: (productId: string, qty?: number, variantId?: string | null) => void;
  setQty: (productId: string, variantId: string | null, qty: number) => void;
  remove: (productId: string, variantId?: string | null) => void;
  toggleSaved: (productId: string, variantId: string | null) => void;
  clear: () => void;
}

const sameLine = (l: CartLine, productId: string, variantId: string | null) =>
  l.productId === productId && (l.variantId ?? null) === (variantId ?? null);

/*
  The cart lives in localStorage rather than a database. Requirement: the store
  must be fully usable signed out, so there is no account to hang a server-side
  cart from. This also removes the entire auth + persistence layer from the
  critical path, which is the single biggest time saving in the build.
*/
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      add: (productId, qty = 1, variantId = null) =>
        set((state) => {
          const existing = state.lines.find((l) => sameLine(l, productId, variantId));
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                sameLine(l, productId, variantId)
                  ? { ...l, qty: Math.min(30, l.qty + qty), saved: false }
                  : l
              ),
            };
          }
          return { lines: [...state.lines, { productId, variantId, qty, saved: false }] };
        }),

      setQty: (productId, variantId, qty) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => !sameLine(l, productId, variantId))
              : state.lines.map((l) =>
                  sameLine(l, productId, variantId) ? { ...l, qty: Math.min(30, qty) } : l
                ),
        })),

      remove: (productId, variantId = null) =>
        set((state) => ({ lines: state.lines.filter((l) => !sameLine(l, productId, variantId)) })),

      toggleSaved: (productId, variantId) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            sameLine(l, productId, variantId) ? { ...l, saved: !l.saved } : l
          ),
        })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: "kartly.cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
    }
  )
);

/** Total units in the active cart, excluding saved-for-later lines. */
export function useCartCount() {
  return useCart((s) => s.lines.reduce((n, l) => (l.saved ? n : n + l.qty), 0));
}

/**
 * True only after the first client-side effect has run.
 *
 * Anything derived from persisted state has to render its server value on the
 * first pass or React reports a hydration mismatch. Gating on mount rather than
 * on a persist callback keeps that guarantee without depending on middleware
 * internals - an earlier version flipped a flag inside onRehydrateStorage, which
 * mutated the store without notifying subscribers and silently pinned the cart
 * badge to zero forever.
 */
export function useIsMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Cart count that is SSR-safe: 0 on the server and first paint, real after. */
export function useHydratedCartCount() {
  const mounted = useIsMounted();
  const count = useCartCount();
  return mounted ? count : 0;
}

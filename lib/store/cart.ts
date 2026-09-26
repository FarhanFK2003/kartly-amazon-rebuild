"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import type { CartIndex, Totals } from "@/lib/commerce";

export interface CartLine {
  productId: string;
  variantId: string | null;
  qty: number;
  /** Moved out of the active cart but kept on the cart page. */
  saved: boolean;
}

/*
  The cart, owned by the server.

  It used to live in localStorage, which made the browser the authority on what
  was in the cart and - through the product index shipped alongside it - on what
  everything cost. PostgreSQL is the authority now: every mutation is a request,
  and the response is the entire cart, repriced from the product rows. This
  store holds the last thing the server said, nothing more.

  Two consequences worth naming:

  * There is no `persist` middleware and no localStorage key any more. The cart
    survives a refresh because it is in the database, keyed to an opaque
    HttpOnly session cookie the page cannot read.

  * Mutations apply optimistically and are then replaced by the server's
    answer. The optimistic step is what keeps the drawer feeling instant; the
    replacement is what makes the server's figures the ones that count. If a
    request fails, the cart is re-read rather than left holding a guess.
*/

interface CartState {
  lines: CartLine[];
  /** Products in the cart, priced by the server. */
  index: CartIndex;
  totals: Totals | null;
  /** True once the first read has come back. */
  ready: boolean;
  pending: number;

  hydrate: () => Promise<void>;
  add: (productId: string, qty?: number, variantId?: string | null) => Promise<void>;
  setQty: (productId: string, variantId: string | null, qty: number) => Promise<void>;
  remove: (productId: string, variantId?: string | null) => Promise<void>;
  toggleSaved: (productId: string, variantId: string | null) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * What a cart read returns. Declared here rather than in lib/data/cart.ts so
 * that client components can name the type without importing a server-only
 * module.
 */
export interface CartSnapshot {
  lines: CartLine[];
  index: CartIndex;
  totals: Totals;
}

const sameLine = (l: CartLine, productId: string, variantId: string | null) =>
  l.productId === productId && (l.variantId ?? null) === (variantId ?? null);

const MAX_LINE_QTY = 30;

export const useCart = create<CartState>()((set, get) => {
  /*
    Requests are numbered, and only the newest answer is allowed to win.

    Without this, clicking the quantity stepper twice and then Remove could put
    the line back: three requests are in flight, they are answered in whatever
    order the network settles, and an older reply - which still contains the
    line - lands last and overwrites the removal. Each response carries the
    sequence number of the request that caused it, and a stale one is dropped.
  */
  let issued = 0;
  let applied = 0;

  const adopt = (seq: number, snapshot: CartSnapshot) => {
    if (seq < applied) return;
    applied = seq;
    set({ lines: snapshot.lines, index: snapshot.index, totals: snapshot.totals, ready: true });
  };

  /** Sends a mutation and adopts whatever cart the server reports back. */
  const send = async (body: Record<string, unknown>) => {
    const seq = ++issued;
    set((s) => ({ pending: s.pending + 1 }));
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      adopt(seq, (await res.json()) as CartSnapshot);
    } catch {
      // The optimistic state is now a guess. Replace it with the truth.
      await get().hydrate();
    } finally {
      set((s) => ({ pending: Math.max(0, s.pending - 1) }));
    }
  };

  return {
    lines: [],
    index: {},
    totals: null,
    ready: false,
    pending: 0,

    hydrate: async () => {
      const seq = ++issued;
      try {
        const res = await fetch("/api/cart", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        adopt(seq, (await res.json()) as CartSnapshot);
      } catch {
        set({ ready: true });
      }
    },

    add: async (productId, qty = 1, variantId = null) => {
      set((state) => {
        const existing = state.lines.find((l) => sameLine(l, productId, variantId));
        return {
          lines: existing
            ? state.lines.map((l) =>
                sameLine(l, productId, variantId)
                  ? { ...l, qty: Math.min(MAX_LINE_QTY, l.qty + qty), saved: false }
                  : l
              )
            : [...state.lines, { productId, variantId, qty, saved: false }],
        };
      });
      await send({ action: "add", productId, variantId, qty });
    },

    setQty: async (productId, variantId, qty) => {
      set((state) => ({
        lines:
          qty <= 0
            ? state.lines.filter((l) => !sameLine(l, productId, variantId))
            : state.lines.map((l) =>
                sameLine(l, productId, variantId)
                  ? { ...l, qty: Math.min(MAX_LINE_QTY, qty) }
                  : l
              ),
      }));
      await send({ action: "setQty", productId, variantId, qty });
    },

    remove: async (productId, variantId = null) => {
      set((state) => ({
        lines: state.lines.filter((l) => !sameLine(l, productId, variantId)),
      }));
      await send({ action: "remove", productId, variantId });
    },

    toggleSaved: async (productId, variantId) => {
      set((state) => ({
        lines: state.lines.map((l) =>
          sameLine(l, productId, variantId) ? { ...l, saved: !l.saved } : l
        ),
      }));
      await send({ action: "toggleSaved", productId, variantId });
    },

    clear: async () => {
      set({ lines: [] });
      set((s) => ({ pending: s.pending + 1 }));
      const seq = ++issued;
      try {
        const res = await fetch("/api/cart", { method: "DELETE" });
        if (res.ok) adopt(seq, (await res.json()) as CartSnapshot);
      } catch {
        await get().hydrate();
      } finally {
        set((s) => ({ pending: Math.max(0, s.pending - 1) }));
      }
    },
  };
});

/** Total units in the active cart, excluding saved-for-later lines. */
export function useCartCount() {
  return useCart((s) => s.lines.reduce((n, l) => (l.saved ? n : n + l.qty), 0));
}

/**
 * True only after the first client-side effect has run.
 *
 * Anything derived from server-owned state has to render its server value on
 * the first pass or React reports a hydration mismatch. Gating on mount keeps
 * that guarantee without depending on store internals.
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

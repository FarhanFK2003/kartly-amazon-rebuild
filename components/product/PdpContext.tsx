"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Product, Variant } from "@/lib/types";

interface PdpState {
  product: Product;
  variant: Variant | null;
  setVariantId: (id: string | null) => void;
  qty: number;
  setQty: (n: number) => void;
  /** Base price plus the selected variant's delta. */
  effectivePrice: number;
}

const Ctx = createContext<PdpState | null>(null);

/**
 * The variant picker sits in the centre column and the buy box in the right
 * column, but they share selection state. A small provider around the whole
 * grid is cheaper than threading props through server components, and keeps
 * both columns rendering from one source of truth.
 */
export function PdpProvider({ product, children }: { product: Product; children: React.ReactNode }) {
  const [variantId, setVariantId] = useState<string | null>(product.variants[0]?.id ?? null);
  const [qty, setQty] = useState(1);

  const value = useMemo<PdpState>(() => {
    const variant = product.variants.find((v) => v.id === variantId) ?? null;
    return {
      product,
      variant,
      setVariantId,
      qty,
      setQty,
      effectivePrice: product.price + (variant?.priceDelta ?? 0),
    };
  }, [product, variantId, qty]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePdp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePdp must be used inside <PdpProvider>");
  return ctx;
}

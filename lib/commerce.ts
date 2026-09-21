import { getAllProducts } from "./catalog";
import { CURRENCY } from "./utils";
import type { CartLine } from "./store/cart";

/*
  Commercial rules live here, not in components. The free-shipping meter, the
  order summary and the confirmation page all read the same numbers, so a
  threshold change is a one-line change.

  All money is in minor units (cents).
*/
export const COMMERCE = {
  freeShippingThreshold: 3500,
  standardShippingCents: 599,
  taxRate: 0.0825,
  currency: CURRENCY.code,
  /** Upper bound on a single line, matching the quantity selectors. */
  maxLineQty: 30,
} as const;

/** The subset of a product the cart and checkout need, sent from server to client. */
export interface CartProduct {
  id: string;
  slug: string;
  title: string;
  image: string | null;
  price: number;
  stock: number;
  deliveryDays: number;
  rating: number;
  reviewCount: number;
  variants: { id: string; label: string; priceDelta: number }[];
}

export type CartIndex = Record<string, CartProduct>;

/**
 * Built on the server and handed to the client. The cart lives in localStorage
 * so the server cannot know its contents, which means the whole index has to
 * travel - but only these fields, not the full catalogue with bullets, specs
 * and 672 reviews attached.
 */
export function getCartIndex(): CartIndex {
  const index: CartIndex = {};
  for (const p of getAllProducts()) {
    index[p.id] = {
      id: p.id,
      slug: p.slug,
      title: p.title,
      image: p.image,
      price: p.price,
      stock: p.stock,
      deliveryDays: p.deliveryDays,
      rating: p.rating,
      reviewCount: p.reviewCount,
      variants: p.variants.map((v) => ({ id: v.id, label: v.label, priceDelta: v.priceDelta })),
    };
  }
  return index;
}

export interface ResolvedLine {
  line: CartLine;
  product: CartProduct;
  variantLabel: string | null;
  unitPrice: number;
  lineTotal: number;
}

/** Joins cart lines to product data, dropping lines whose product has vanished. */
export function resolveLines(lines: CartLine[], index: CartIndex): ResolvedLine[] {
  const out: ResolvedLine[] = [];
  for (const line of lines) {
    const product = index[line.productId];
    if (!product) continue;
    const variant = line.variantId ? product.variants.find((v) => v.id === line.variantId) : null;
    const unitPrice = product.price + (variant?.priceDelta ?? 0);
    out.push({
      line,
      product,
      variantLabel: variant?.label ?? null,
      unitPrice,
      lineTotal: unitPrice * line.qty,
    });
  }
  return out;
}

export interface Totals {
  itemCount: number;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  freeShipping: boolean;
  /** Cents still needed to qualify; 0 once unlocked. */
  remainingForFreeShipping: number;
}

/** Every total shown anywhere is derived here from the real cart lines. */
export function computeTotals(resolved: ResolvedLine[]): Totals {
  const active = resolved.filter((r) => !r.line.saved);
  const itemCount = active.reduce((n, r) => n + r.line.qty, 0);
  const subtotal = active.reduce((n, r) => n + r.lineTotal, 0);

  const freeShipping = subtotal >= COMMERCE.freeShippingThreshold;
  const shipping = itemCount === 0 || freeShipping ? 0 : COMMERCE.standardShippingCents;
  const tax = Math.round(subtotal * COMMERCE.taxRate);

  return {
    itemCount,
    subtotal,
    shipping,
    tax,
    total: subtotal + shipping + tax,
    freeShipping,
    remainingForFreeShipping: Math.max(0, COMMERCE.freeShippingThreshold - subtotal),
  };
}

/* ---------- orders ---------- */

export interface OrderAddress {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface OrderPayment {
  /** "card" is a simulated card; no real details are ever collected or stored. */
  method: "card" | "on-delivery";
  brand?: string;
  last4?: string;
}

export interface OrderItem {
  productId: string;
  slug: string;
  title: string;
  image: string | null;
  variantLabel: string | null;
  qty: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  placedAt: string;
  deliveryDate: string;
  items: OrderItem[];
  address: OrderAddress;
  payment: OrderPayment;
  totals: Totals;
  /** Flags this as a demo order so nothing here can be mistaken for a real one. */
  simulated: true;
}

/**
 * Order items are a snapshot, not a reference. A past order must keep showing
 * the price and title that were actually bought even if the catalogue changes.
 */
export function toOrderItems(resolved: ResolvedLine[]): OrderItem[] {
  return resolved
    .filter((r) => !r.line.saved)
    .map((r) => ({
      productId: r.product.id,
      slug: r.product.slug,
      title: r.product.title,
      image: r.product.image,
      variantLabel: r.variantLabel,
      qty: r.line.qty,
      unitPrice: r.unitPrice,
    }));
}

export function generateOrderId(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const noise = Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `KTL-${stamp}-${noise}`;
}

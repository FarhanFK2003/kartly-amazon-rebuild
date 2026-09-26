import "server-only";
import { prisma } from "@/lib/db";
import { ClientError } from "@/lib/api/errors";
import {
  COMMERCE,
  computeTotals,
  resolveLines,
  type CartIndex,
  type CartProduct,
  type Totals,
} from "@/lib/commerce";
import type { CartLine } from "@/lib/store/cart";

/*
  The server-side cart.

  PostgreSQL is the authority. The browser may say which product and how many;
  it may never say what anything costs. Price, discount, stock, the variant
  price delta, the subtotal, shipping, tax and the total are all resolved here
  from the database and computed by lib/commerce.ts - which is the same module
  the UI has always used, so there is no second pricing formula anywhere.

  Every function takes a sessionId. Nothing is reachable without one, and one
  session's id never appears in another session's query.
*/

/** What a cart read returns: the lines, the products they point at, the money. */
export type { CartSnapshot } from "@/lib/store/cart";
import type { CartSnapshot } from "@/lib/store/cart";

const EMPTY: CartSnapshot = {
  lines: [],
  index: {},
  totals: computeTotals([]),
};

/** Collapses a nullable variant id to the non-null key the unique index uses. */
const keyFor = (variantId: string | null) => variantId ?? "";

/* ------------------------------------------------------------------ */
/* validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Checks that the product exists, that the variant belongs to it, and that the
 * quantity is sane - before anything is written.
 *
 * A variant id that belongs to a different product is rejected rather than
 * ignored: silently dropping it would let a client attach a cheaper variant's
 * price delta to an expensive product.
 */
async function validate(productId: string, variantId: string | null, qty: number) {
  if (!Number.isInteger(qty) || qty < 1 || qty > COMMERCE.maxLineQty) {
    throw new ClientError(`Quantity must be a whole number between 1 and ${COMMERCE.maxLineQty}`);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, stock: true, variants: { select: { id: true } } },
  });
  if (!product) throw new ClientError("Unknown product", 404);

  if (variantId && !product.variants.some((v) => v.id === variantId)) {
    throw new ClientError("Unknown variant for this product", 400);
  }

  if (product.stock <= 0) throw new ClientError("This product is out of stock", 409);

  return product;
}

/* ------------------------------------------------------------------ */
/* reads                                                               */
/* ------------------------------------------------------------------ */

/**
 * The cart for a session, priced from the database.
 *
 * The index is built from the products actually in the cart rather than from
 * the whole catalogue, which is what the static implementation had to do when
 * the server could not know the cart's contents.
 */
export async function getCart(sessionId: string | null): Promise<CartSnapshot> {
  if (!sessionId) return EMPTY;

  const cart = await prisma.cart.findUnique({
    where: { sessionId },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              title: true,
              image: true,
              price: true,
              stock: true,
              deliveryDays: true,
              rating: true,
              reviewCount: true,
              variants: { select: { id: true, label: true, priceDelta: true }, orderBy: { position: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) return EMPTY;

  const index: CartIndex = {};
  const lines: CartLine[] = [];

  for (const item of cart.items) {
    const p = item.product;
    if (!index[p.id]) {
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
        variants: p.variants,
      } satisfies CartProduct;
    }
    lines.push({
      productId: item.productId,
      variantId: item.variantId,
      qty: item.qty,
      saved: item.saved,
    });
  }

  // The same two functions the cart page and checkout have always used.
  return { lines, index, totals: computeTotals(resolveLines(lines, index)) };
}

/* ------------------------------------------------------------------ */
/* writes                                                              */
/* ------------------------------------------------------------------ */

/** The session's cart row, created on first write. */
async function openCart(sessionId: string) {
  return prisma.cart.upsert({
    where: { sessionId },
    create: { sessionId },
    update: {},
    select: { id: true },
  });
}

/**
 * Adds to a line, or creates it.
 *
 * Adding a product already in the cart increases that line rather than making a
 * second one - the behaviour the localStorage cart had - and the unique index
 * on (cart, product, variantKey) guarantees it even under concurrent requests.
 * Adding something that was saved for later moves it back into the active cart,
 * also matching the previous behaviour.
 */
export async function addItem(
  sessionId: string,
  productId: string,
  qty = 1,
  variantId: string | null = null
): Promise<CartSnapshot> {
  await validate(productId, variantId, qty);
  const cart = await openCart(sessionId);
  const variantKey = keyFor(variantId);

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId_variantKey: { cartId: cart.id, productId, variantKey } },
    select: { id: true, qty: true },
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { qty: Math.min(COMMERCE.maxLineQty, existing.qty + qty), saved: false },
    });
  } else {
    const last = await prisma.cartItem.findFirst({
      where: { cartId: cart.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId,
        variantKey,
        qty: Math.min(COMMERCE.maxLineQty, qty),
        position: (last?.position ?? -1) + 1,
      },
    });
  }

  return getCart(sessionId);
}

/** Sets an exact quantity. Zero or less removes the line, as it always did. */
export async function setQty(
  sessionId: string,
  productId: string,
  variantId: string | null,
  qty: number
): Promise<CartSnapshot> {
  if (qty <= 0) return removeItem(sessionId, productId, variantId);
  await validate(productId, variantId, qty);

  const cart = await openCart(sessionId);
  await prisma.cartItem.updateMany({
    where: { cartId: cart.id, productId, variantKey: keyFor(variantId) },
    data: { qty: Math.min(COMMERCE.maxLineQty, qty) },
  });
  return getCart(sessionId);
}

/** Moves a line in or out of save-for-later. */
export async function toggleSaved(
  sessionId: string,
  productId: string,
  variantId: string | null
): Promise<CartSnapshot> {
  const cart = await openCart(sessionId);
  const item = await prisma.cartItem.findUnique({
    where: { cartId_productId_variantKey: { cartId: cart.id, productId, variantKey: keyFor(variantId) } },
    select: { id: true, saved: true },
  });
  if (!item) throw new ClientError("That item is not in the cart", 404);

  await prisma.cartItem.update({ where: { id: item.id }, data: { saved: !item.saved } });
  return getCart(sessionId);
}

export async function removeItem(
  sessionId: string,
  productId: string,
  variantId: string | null
): Promise<CartSnapshot> {
  const cart = await prisma.cart.findUnique({ where: { sessionId }, select: { id: true } });
  if (cart) {
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id, productId, variantKey: keyFor(variantId) },
    });
  }
  return getCart(sessionId);
}

export async function clearCart(sessionId: string): Promise<CartSnapshot> {
  const cart = await prisma.cart.findUnique({ where: { sessionId }, select: { id: true } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(sessionId);
}

import "server-only";
import { prisma } from "@/lib/db";
import { ClientError } from "@/lib/api/errors";
import {
  computeTotals,
  generateOrderId,
  resolveLines,
  toOrderItems,
  type Order,
  type OrderAddress,
  type OrderPayment,
} from "@/lib/commerce";
import { getCart, clearCart } from "./cart";
import { getCurrentUser } from "@/lib/auth";

/*
  Placing and reading orders.

  The browser sends an address, a payment method and an idempotency key. It does
  not send prices, quantities or totals - those come from the cart in
  PostgreSQL, priced from the product rows, and run through the same
  computeTotals() the cart page uses. A client that posts its own subtotal is
  simply ignored, because there is nowhere in this module for it to be read.

  No card number, expiry or CVV is accepted or stored. The confirmation screen
  shows a brand and last four digits, so those two fields are all that is kept.
*/

/** Days from placement to the delivery date shown on the confirmation. */
const DELIVERY_DAYS = 4;

export interface PlaceOrderInput {
  address: OrderAddress;
  payment: OrderPayment;
  /** One per checkout attempt. A repeat returns the original order. */
  idempotencyKey: string;
}

const REQUIRED_ADDRESS_FIELDS = ["fullName", "line1", "city", "state", "zip", "phone"] as const;

function validateInput(input: PlaceOrderInput) {
  if (!input?.idempotencyKey || typeof input.idempotencyKey !== "string") {
    throw new ClientError("A checkout attempt id is required");
  }
  if (!input.address || typeof input.address !== "object") {
    throw new ClientError("A delivery address is required");
  }
  for (const field of REQUIRED_ADDRESS_FIELDS) {
    const value = input.address[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ClientError(`Delivery address is missing ${field}`);
    }
  }
  if (input.payment?.method !== "card" && input.payment?.method !== "on-delivery") {
    throw new ClientError("Choose a payment method");
  }
}

/**
 * Creates an order from the session's cart.
 *
 * Resubmitting the same checkout returns the order that was already created
 * rather than making a second one. The idempotency key is unique in the
 * database, so two requests racing each other end with one order and one
 * winner - the loser catches the constraint violation and reads the winner's
 * row, which is why this is safe without a lock.
 */
export async function placeOrder(sessionId: string, input: PlaceOrderInput): Promise<Order> {
  validateInput(input);

  /*
    Who the order belongs to. An account when there is one, and the guest
    session otherwise - the two are not interchangeable, which is why both are
    recorded and why reads check whichever applies.
  */
  const account = await getCurrentUser();

  const already = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (already) {
    if (!ownsOrder(already, sessionId, account?.id ?? null)) {
      throw new ClientError("Order not found", 404);
    }
    return toOrder(already);
  }

  // Authoritative: the cart as the database has it, priced from product rows.
  const { lines, index, totals } = await getCart(sessionId);
  const resolved = resolveLines(lines, index);
  const items = toOrderItems(resolved);

  if (items.length === 0) throw new ClientError("Your cart is empty", 409);

  // Stock is re-checked at the moment of purchase, not only when adding.
  for (const item of items) {
    const product = index[item.productId];
    if (!product || product.stock <= 0) {
      throw new ClientError(`${item.title.split(",")[0]} is no longer available`, 409);
    }
  }

  const placedAt = new Date();
  const deliveryDate = new Date(placedAt);
  deliveryDate.setUTCDate(deliveryDate.getUTCDate() + DELIVERY_DAYS);

  const id = generateOrderId();
  const a = input.address;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          id,
          sessionId,
          userId: account?.id ?? null,
          subtotal: totals.subtotal,
          shipping: totals.shipping,
          tax: totals.tax,
          total: totals.total,
          itemCount: totals.itemCount,
          shipFullName: a.fullName,
          shipLine1: a.line1,
          shipLine2: a.line2 || null,
          shipCity: a.city,
          shipState: a.state,
          shipZip: a.zip,
          shipPhone: a.phone,
          paymentMethod: input.payment.method,
          // Never a card number, expiry or CVV - only what the receipt shows.
          paymentBrand: input.payment.brand ?? null,
          paymentLast4: input.payment.last4 ?? null,
          deliveryDate,
          idempotencyKey: input.idempotencyKey,
          placedAt,
          items: {
            create: items.map((item, position) => ({
              productId: item.productId,
              variantId:
                resolved.find((r) => r.product.id === item.productId)?.line.variantId ?? null,
              slug: item.slug,
              title: item.title,
              image: item.image,
              variantLabel: item.variantLabel,
              qty: item.qty,
              unitPrice: item.unitPrice,
              position,
            })),
          },
        },
        include: { items: { orderBy: { position: "asc" } } },
      });
      return order;
    });

    await clearCart(sessionId);
    return toOrder(created);
  } catch (error) {
    // Lost a race on the idempotency key: the other request created the order.
    if (isUniqueViolation(error)) {
      const winner = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: { orderBy: { position: "asc" } } },
      });
      if (winner && ownsOrder(winner, sessionId, account?.id ?? null)) return toOrder(winner);
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * One order, scoped to the session that placed it.
 *
 * An order id on its own is not authorisation. Ids are short and shown on a
 * confirmation screen, so without this check anyone could page through other
 * people's orders - and those carry a name, address and phone number.
 */
export async function getOrder(sessionId: string | null, id: string): Promise<Order | null> {
  const where = await ownerFilter(sessionId);
  if (!where) return null;

  const row = await prisma.order.findFirst({
    where: { id, ...where },
    include: { items: { orderBy: { position: "asc" } } },
  });
  return row ? toOrder(row) : null;
}

/** The current owner's orders, newest first. */
export async function listOrders(sessionId: string | null): Promise<Order[]> {
  const where = await ownerFilter(sessionId);
  if (!where) return [];

  const rows = await prisma.order.findMany({
    where,
    orderBy: { placedAt: "desc" },
    include: { items: { orderBy: { position: "asc" } } },
  });
  return rows.map(toOrder);
}

/**
 * Which orders the current visitor may see.
 *
 * Signed in, that is their account's orders and nothing else - not the guest
 * orders that happen to share the browser, because the guest cookie survives a
 * sign-out and would otherwise hand the next person the previous one's
 * history. Signed out, it is the guest session's own orders, excluding any
 * that have since been claimed by an account.
 */
async function ownerFilter(
  sessionId: string | null
): Promise<{ userId: string } | { sessionId: string; userId: null } | null> {
  const account = await getCurrentUser();
  if (account) return { userId: account.id };
  if (!sessionId) return null;
  return { sessionId, userId: null };
}

/** Whether an already-created order belongs to the current visitor. */
function ownsOrder(
  order: { sessionId: string; userId: string | null },
  sessionId: string,
  userId: string | null
): boolean {
  return userId ? order.userId === userId : order.sessionId === sessionId && order.userId === null;
}

/* ------------------------------------------------------------------ */
/* mapping                                                             */
/* ------------------------------------------------------------------ */

type OrderRow = Awaited<ReturnType<typeof prisma.order.findFirstOrThrow>> & {
  items: Awaited<ReturnType<typeof prisma.orderItem.findMany>>;
};

/**
 * A database row as the Order shape the UI already renders.
 *
 * Totals are re-derived from the stored columns rather than recomputed from the
 * items, because a past order must keep the figures it was actually placed
 * with even if the commerce constants change later.
 */
function toOrder(row: OrderRow): Order {
  const subtotal = row.subtotal;
  return {
    id: row.id,
    placedAt: row.placedAt.toISOString(),
    deliveryDate: row.deliveryDate.toISOString(),
    items: row.items.map((i) => ({
      productId: i.productId,
      slug: i.slug,
      title: i.title,
      image: i.image,
      variantLabel: i.variantLabel,
      qty: i.qty,
      unitPrice: i.unitPrice,
    })),
    address: {
      fullName: row.shipFullName,
      line1: row.shipLine1,
      line2: row.shipLine2 ?? undefined,
      city: row.shipCity,
      state: row.shipState,
      zip: row.shipZip,
      phone: row.shipPhone,
    },
    payment: {
      method: row.paymentMethod as Order["payment"]["method"],
      brand: row.paymentBrand ?? undefined,
      last4: row.paymentLast4 ?? undefined,
    },
    totals: {
      itemCount: row.itemCount,
      subtotal,
      shipping: row.shipping,
      tax: row.tax,
      total: row.total,
      freeShipping: row.shipping === 0 && row.itemCount > 0,
      remainingForFreeShipping: 0,
    },
    simulated: true,
  };
}

import { NextResponse } from "next/server";
import { apiError, ClientError } from "@/lib/api/errors";
import { getSessionId, requireSessionId } from "@/lib/session";
import { addItem, clearCart, getCart, removeItem, setQty, toggleSaved } from "@/lib/data/cart";

/*
  The cart API.

  Every response is the whole authoritative cart - lines, the products they
  point at and the money - so the client never has to compute or merge
  anything. It replaces its state with what the server says the cart is.

  Note what the request bodies accept: a product id, an optional variant id and
  a quantity. There is no price field, no subtotal field and no total field,
  anywhere. A client that sends one is not rejected so much as unheard, because
  nothing reads it.
*/

export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  try {
    // Read-only: a visitor who has never interacted gets an empty cart rather
    // than a freshly minted session.
    return NextResponse.json(await getCart(await getSessionId()), noStore);
  } catch (error) {
    return apiError(error, "GET /api/cart");
  }
}

type Body = {
  action?: string;
  productId?: unknown;
  variantId?: unknown;
  qty?: unknown;
};

async function readBody(request: Request): Promise<Body> {
  try {
    return (await request.json()) as Body;
  } catch {
    throw new ClientError("Expected a JSON body");
  }
}

const asId = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) {
    throw new ClientError(`"${field}" must be a product or variant id`);
  }
  return value;
};

const asVariant = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") return null;
  return asId(value, "variantId");
};

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const sessionId = await requireSessionId();
    const productId = asId(body.productId, "productId");
    const variantId = asVariant(body.variantId);
    const qty = body.qty === undefined ? 1 : Number(body.qty);

    switch (body.action ?? "add") {
      case "add":
        return NextResponse.json(await addItem(sessionId, productId, qty, variantId), noStore);
      case "setQty":
        return NextResponse.json(await setQty(sessionId, productId, variantId, qty), noStore);
      case "toggleSaved":
        return NextResponse.json(await toggleSaved(sessionId, productId, variantId), noStore);
      case "remove":
        return NextResponse.json(await removeItem(sessionId, productId, variantId), noStore);
      default:
        throw new ClientError(`Unknown action "${String(body.action)}"`);
    }
  } catch (error) {
    return apiError(error, "POST /api/cart");
  }
}

export async function DELETE() {
  try {
    return NextResponse.json(await clearCart(await requireSessionId()), noStore);
  } catch (error) {
    return apiError(error, "DELETE /api/cart");
  }
}

import { NextResponse } from "next/server";
import { apiError, ClientError } from "@/lib/api/errors";
import { getSessionId, requireSessionId } from "@/lib/session";
import { listOrders, placeOrder } from "@/lib/data/orders";

/*
  Orders.

  POST places one from the session's cart. The body carries an address, a
  payment method and a checkout-attempt id - never prices, quantities or
  totals, which are read from the cart in PostgreSQL and computed by
  lib/commerce.ts.

  GET lists this session's orders and nobody else's.
*/

export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  try {
    return NextResponse.json({ orders: await listOrders(await getSessionId()) }, noStore);
  } catch (error) {
    return apiError(error, "GET /api/orders");
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(new ClientError("Expected a JSON body"), "POST /api/orders");
  }

  try {
    const sessionId = await requireSessionId();
    const { address, payment, idempotencyKey } = (body ?? {}) as Record<string, never>;
    const order = await placeOrder(sessionId, { address, payment, idempotencyKey });
    return NextResponse.json({ order }, { status: 201, ...noStore });
  } catch (error) {
    return apiError(error, "POST /api/orders");
  }
}

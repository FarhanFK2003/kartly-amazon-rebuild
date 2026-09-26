import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { getSessionId } from "@/lib/session";
import { getOrder } from "@/lib/data/orders";

/*
  One order.

  Scoped to the session that placed it. An order id alone is not authorisation:
  the ids are short and shown on a confirmation screen, and the records carry a
  name, address and phone number. An order belonging to someone else is a 404,
  not a 403, so this cannot be used to discover which ids exist.
*/

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/api/orders/[id]">) {
  try {
    const { id } = await ctx.params;
    const order = await getOrder(await getSessionId(), id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "GET /api/orders/[id]");
  }
}

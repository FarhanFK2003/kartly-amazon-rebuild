import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/checkout/OrderConfirmation";
import { getOrder } from "@/lib/data/orders";
import { getSessionId } from "@/lib/session";

export const metadata: Metadata = { title: "Order placed" };

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const id = decodeURIComponent(orderId);
  /*
    Read on the server, scoped to the session cookie that placed the order. An
    order id on its own is not authorisation - these records carry a name, an
    address and a phone number.
  */
  const order = await getOrder(await getSessionId(), id);
  return <OrderConfirmation orderId={id} order={order} />;
}

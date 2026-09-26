import type { Metadata } from "next";
import { getBestSellers } from "@/lib/data/products";
import { listOrders } from "@/lib/data/orders";
import { getSessionId } from "@/lib/session";
import { OrdersView } from "@/components/orders/OrdersView";

export const metadata: Metadata = { title: "Your Orders" };

export default async function OrdersPage() {
  // This session's orders, read from PostgreSQL on the server.
  const [recommended, orders] = await Promise.all([
    getBestSellers(10),
    listOrders(await getSessionId()),
  ]);
  return <OrdersView recommended={recommended} orders={orders} />;
}

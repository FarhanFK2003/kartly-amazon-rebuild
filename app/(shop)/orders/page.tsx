import type { Metadata } from "next";
import { getBestSellers } from "@/lib/catalog";
import { OrdersView } from "@/components/orders/OrdersView";

export const metadata: Metadata = { title: "Your Orders" };

export default function OrdersPage() {
  // Orders live in localStorage, so the list is resolved on the client.
  return <OrdersView recommended={getBestSellers(10)} />;
}

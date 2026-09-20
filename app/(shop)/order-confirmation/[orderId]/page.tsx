import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/checkout/OrderConfirmation";

export const metadata: Metadata = { title: "Order placed" };

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  // Orders live in localStorage, so the lookup happens on the client.
  return <OrderConfirmation orderId={decodeURIComponent(orderId)} />;
}

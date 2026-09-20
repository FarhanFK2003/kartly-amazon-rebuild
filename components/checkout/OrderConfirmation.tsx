"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Package } from "lucide-react";
import { useOrders } from "@/lib/store/orders";
import { useIsMounted } from "@/lib/store/cart";
import { ButtonLink } from "@/components/ui/Button";
import { formatPrice, pluralize } from "@/lib/utils";

const LONG_DATE: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
};

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const mounted = useIsMounted();
  const order = useOrders((s) => s.orders.find((o) => o.id === orderId));

  if (!mounted) return <div className="shell py-10" aria-busy="true" />;

  // Orders live in this browser only, so a link opened elsewhere genuinely has
  // nothing to show. Say that plainly instead of rendering an empty receipt.
  if (!order) {
    return (
      <div className="shell py-16 text-center">
        <h1 className="text-[24px] font-bold text-ink">We can&apos;t find that order</h1>
        <p className="mx-auto mt-2 max-w-[480px] text-[14px] text-muted">
          Order <span className="font-mono">{orderId}</span> isn&apos;t stored in this browser.
          Kartly keeps simulated orders on the device that placed them, so it won&apos;t appear
          after clearing site data or on another machine.
        </p>
        <div className="mt-6">
          <ButtonLink href="/s" variant="primary" size="md">
            Continue shopping
          </ButtonLink>
        </div>
      </div>
    );
  }

  const placed = new Date(order.placedAt);
  const delivery = new Date(order.deliveryDate);
  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);

  return (
    <div className="shell py-6">
      {/* success banner */}
      <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-4">
        <CheckCircle2 className="h-10 w-10 shrink-0 text-success" strokeWidth={1.8} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-bold text-success">Order placed</h1>
          <p className="mt-1 text-[14px] text-ink">
            Thank you. A confirmation would normally be emailed to you.
          </p>
          <p className="mt-1 text-[13px] text-muted">
            This is a <strong>simulated order</strong> in a demo storefront. Nothing has been
            charged and nothing will ship.
          </p>
        </div>
        <ButtonLink href="/s" variant="primary" size="md" className="shrink-0">
          Continue shopping
        </ButtonLink>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          {/* order meta */}
          <div className="card p-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Meta label="Order number">
                <span className="font-mono text-[14px] font-bold text-ink">{order.id}</span>
              </Meta>
              <Meta label="Order date">{placed.toLocaleDateString("en-US", LONG_DATE)}</Meta>
              <Meta label="Order total">
                <span className="font-bold">{formatPrice(order.totals.total)}</span>
              </Meta>
            </dl>

            <div className="mt-4 flex items-start gap-3 rounded-[8px] border border-line-soft bg-[#f7f8f8] p-3">
              <Package className="mt-[2px] h-5 w-5 shrink-0 text-muted" />
              <div>
                <p className="text-[14px] font-bold text-ink">
                  Arriving {delivery.toLocaleDateString("en-US", LONG_DATE)}
                </p>
                <p className="text-[13px] text-muted">
                  {itemCount} {pluralize(itemCount, "item")} shipping to {order.address.city},{" "}
                  {order.address.state}
                </p>
              </div>
            </div>
          </div>

          {/* items */}
          <div className="card p-5">
            <h2 className="text-[18px] font-bold text-ink">
              {itemCount} {pluralize(itemCount, "item")} in this order
            </h2>
            <ul className="mt-3 divide-y divide-line-soft">
              {order.items.map((item) => (
                <li key={`${item.productId}-${item.variantLabel ?? "base"}`} className="flex gap-3 py-3">
                  <Link href={`/dp/${item.slug}`} className="shrink-0">
                    <div className="relative h-[80px] w-[80px] bg-white">
                      {item.image && (
                        <Image src={item.image} alt={item.title} fill sizes="80px" className="object-contain" />
                      )}
                    </div>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dp/${item.slug}`}
                      className="clamp-2 text-[14px] leading-5 text-link hover:text-link-hover hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.variantLabel && (
                      <p className="text-[12px] text-muted">{item.variantLabel}</p>
                    )}
                    <p className="text-[12px] text-muted">
                      Qty: {item.qty} &middot; {formatPrice(item.unitPrice)} each
                    </p>
                  </div>
                  <p className="shrink-0 text-[14px] font-bold text-ink">
                    {formatPrice(item.unitPrice * item.qty)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* summary rail */}
        <aside className="w-full lg:w-[320px] lg:shrink-0">
          <div className="card p-5">
            <h2 className="text-[18px] font-bold text-ink">Order summary</h2>
            <dl className="mt-3 space-y-1 text-[13px]">
              <Row label={`Items (${itemCount})`} value={formatPrice(order.totals.subtotal)} />
              <Row
                label="Shipping"
                value={order.totals.freeShipping ? "FREE" : formatPrice(order.totals.shipping)}
                accent={order.totals.freeShipping}
              />
              <Row label="Estimated tax" value={formatPrice(order.totals.tax)} />
            </dl>
            <div className="mt-2 flex justify-between border-t border-line-soft pt-2 text-[18px] font-bold text-deal">
              <span>Order total</span>
              <span>{formatPrice(order.totals.total)}</span>
            </div>

            <h3 className="mt-5 border-t border-line-soft pt-4 text-[15px] font-bold text-ink">
              Delivering to
            </h3>
            <address className="mt-1 not-italic text-[13px] leading-5 text-ink">
              {order.address.fullName}
              <br />
              {order.address.line1}
              {order.address.line2 && (
                <>
                  <br />
                  {order.address.line2}
                </>
              )}
              <br />
              {order.address.city}, {order.address.state} {order.address.zip}
              <br />
              {order.address.phone}
            </address>

            <h3 className="mt-5 border-t border-line-soft pt-4 text-[15px] font-bold text-ink">
              Payment method
            </h3>
            <p className="mt-1 text-[13px] text-ink">
              {order.payment.method === "card" ? (
                <>
                  {order.payment.brand} ending in {order.payment.last4}
                  <span className="block text-[12px] text-muted">Simulated - nothing charged</span>
                </>
              ) : (
                <>
                  Pay on delivery
                  <span className="block text-[12px] text-muted">Simulated</span>
                </>
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-[2px] text-[14px] text-ink">{children}</dd>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink">{label}</dt>
      <dd className={accent ? "font-bold text-success" : "text-ink"}>{value}</dd>
    </div>
  );
}

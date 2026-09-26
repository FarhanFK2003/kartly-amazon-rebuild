"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Package, ChevronDown } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ProductCard } from "@/components/product/ProductCard";
import { formatPrice, pluralize } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/commerce";
import type { Product } from "@/lib/types";

const DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };

export function OrdersView({ recommended, orders }: { recommended: Product[]; orders: Order[] }) {
  // Orders arrive from the server, already scoped to this session, so there is
  // no mount gate and no skeleton pass any more.
  if (orders.length === 0) return <NoOrders recommended={recommended} />;

  return (
    <div className="shell py-4">
      <h1 className="text-[24px] font-normal leading-9 text-ink sm:text-[28px]">Your Orders</h1>
      <p className="mt-1 text-[13px] text-muted">
        {orders.length} simulated {pluralize(orders.length, "order")} on this session.
      </p>

      <ul className="mt-4 space-y-4">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </ul>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);
  const delivery = new Date(order.deliveryDate);
  const delivered = delivery.getTime() < Date.now();

  return (
    <li className="card overflow-hidden">
      {/* header strip */}
      <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-line bg-[#f0f2f2] px-4 py-3 sm:px-5">
        <Meta label="Order placed">{new Date(order.placedAt).toLocaleDateString("en-US", DATE)}</Meta>
        <Meta label="Total">{formatPrice(order.totals.total)}</Meta>
        <Meta label="Items">{itemCount}</Meta>
        <div className="ml-auto text-left sm:text-right">
          <p className="text-[12px] uppercase tracking-wide text-muted">Order #</p>
          <p className="font-mono text-[13px] text-ink">{order.id}</p>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[12px] font-bold",
              delivered ? "bg-[#e7f5ea] text-success" : "bg-[#eaf3fb] text-[#2b6cb0]"
            )}
          >
            <Package className="h-3 w-3" aria-hidden />
            {delivered ? "Delivered" : "On the way"}
          </span>
          <p className="text-[14px] font-bold text-ink">
            {delivered ? "Arrived" : "Arriving"} {delivery.toLocaleDateString("en-US", DATE)}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-start gap-4">
          {/* thumbnails */}
          <div className="flex flex-wrap gap-2">
            {order.items.slice(0, 4).map((item) => (
              <Link
                key={`${item.productId}-${item.variantLabel ?? "base"}`}
                href={`/dp/${item.slug}`}
                className="relative h-[68px] w-[68px] shrink-0 rounded-[4px] border border-line-soft bg-white"
                title={item.title}
              >
                {item.image && (
                  <Image src={item.image} alt={item.title} fill sizes="68px" className="object-contain p-1" />
                )}
              </Link>
            ))}
            {order.items.length > 4 && (
              <span className="flex h-[68px] w-[68px] items-center justify-center rounded-[4px] border border-line-soft bg-[#f7f8f8] text-[13px] text-muted">
                +{order.items.length - 4}
              </span>
            )}
          </div>

          <div className="ml-auto flex flex-col gap-2">
            <ButtonLink href={`/order-confirmation/${order.id}`} variant="outline" size="sm">
              View order details
            </ButtonLink>
            <ButtonLink href={`/dp/${order.items[0]?.slug ?? ""}`} variant="outline" size="sm">
              Buy it again
            </ButtonLink>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="link mt-3 flex items-center gap-1 text-[13px]"
        >
          {open ? "Hide" : "Show"} description
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <ul className="mt-3 divide-y divide-line-soft border-t border-line-soft">
            {order.items.map((item) => (
              <li key={`${item.productId}-${item.variantLabel ?? "base"}-row`} className="flex gap-3 py-3">
                <div className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[4px] bg-white">
                  {item.image && (
                    <Image src={item.image} alt="" fill sizes="56px" className="object-contain" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/dp/${item.slug}`} className="clamp-2 text-[13px] leading-[18px] text-link hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-[12px] text-muted">
                    Qty {item.qty} &middot; {formatPrice(item.unitPrice)} each
                  </p>
                </div>
                <p className="shrink-0 text-[13px] font-bold text-ink">
                  {formatPrice(item.unitPrice * item.qty)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-[13px] text-ink">{children}</p>
    </div>
  );
}

function NoOrders({ recommended }: { recommended: Product[] }) {
  return (
    <div className="shell py-4">
      <div className="card flex flex-col items-center gap-5 px-6 py-12 text-center sm:flex-row sm:text-left">
        <div className="flex h-[110px] w-[110px] shrink-0 items-center justify-center rounded-full bg-[#f3f4f4]">
          <Package className="h-12 w-12 text-[#b9bdbd]" strokeWidth={1.4} />
        </div>
        <div>
          <h1 className="text-[22px] font-normal leading-8 text-ink sm:text-[24px]">No orders yet</h1>
          <p className="mt-2 max-w-[460px] text-[14px] text-muted">
            Orders you place are simulated and stored in this browser, so they appear here on this
            device only. Place one and it will show up immediately.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <ButtonLink href="/s" variant="primary" size="md">
              Start shopping
            </ButtonLink>
            <Link href="/" className="link text-[14px]">
              Go to the homepage
            </Link>
          </div>
        </div>
      </div>

      {recommended.length > 0 && (
        <section className="card mt-4 p-4 sm:p-5">
          <SectionHeader title="Popular right now" size="md" className="mb-4" />
          <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
            {recommended.map((p) => (
              <div key={p.id} className="w-[160px] shrink-0 sm:w-[190px]">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

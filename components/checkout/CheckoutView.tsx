"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CreditCard, Truck } from "lucide-react";
import { useCart, useIsMounted } from "@/lib/store/cart";
import { useCheckout } from "@/lib/store/checkout";
import { useOrders } from "@/lib/store/orders";
import {
  computeTotals,
  generateOrderId,
  resolveLines,
  toOrderItems,
  type CartIndex,
  type Order,
} from "@/lib/commerce";
import { validateAddress, validateCard, hasErrors, cardBrand, US_STATES, type Errors } from "@/lib/validation";
import type { OrderAddress } from "@/lib/commerce";
import type { CardDraft } from "@/lib/store/checkout";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { CheckoutStepPanel } from "@/components/checkout/CheckoutStep";
import { formatPrice, deliveryDate, pluralize } from "@/lib/utils";
import { TID } from "@/lib/testids";

export function CheckoutView({ index }: { index: CartIndex }) {
  const mounted = useIsMounted();
  const router = useRouter();

  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const addOrder = useOrders((s) => s.addOrder);

  const {
    step, setStep, address, setAddress, paymentMethod, setPaymentMethod,
    card, setCard, completed, markComplete, reset,
  } = useCheckout();

  const [addressErrors, setAddressErrors] = useState<Errors<OrderAddress>>({});
  const [cardErrors, setCardErrors] = useState<Errors<CardDraft>>({});
  const [paymentError, setPaymentError] = useState<string>("");
  const [placing, setPlacing] = useState(false);

  const resolved = resolveLines(lines, index);
  const active = resolved.filter((r) => !r.line.saved);
  const totals = computeTotals(resolved);

  if (!mounted) return <div className="mx-auto max-w-[1000px] px-4 py-10" aria-busy="true" />;

  // Reaching checkout with nothing to buy is a dead end, so say so and offer the
  // way back rather than redirecting and losing the shopper's place.
  if (active.length === 0) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-16 text-center">
        <h2 className="text-[24px] font-bold text-ink">There is nothing to check out</h2>
        <p className="mx-auto mt-2 max-w-[440px] text-body text-ink-2">
          Your cart is empty. Add something to it and the checkout will be waiting.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/s" variant="primary" size="md">
            Continue shopping
          </ButtonLink>
          <Link href="/cart" className="text-body font-medium text-brand hover:underline">
            Back to cart
          </Link>
        </div>
      </div>
    );
  }

  const delivery = deliveryDate(Math.max(...active.map((r) => r.product.deliveryDays)));

  function submitAddress(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateAddress(address);
    setAddressErrors(errs);
    if (hasErrors(errs)) return;
    markComplete(1);
    setStep(2);
  }

  function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentMethod) {
      setPaymentError("Select a payment method to continue.");
      return;
    }
    setPaymentError("");

    if (paymentMethod === "card") {
      const errs = validateCard(card);
      setCardErrors(errs);
      if (hasErrors(errs)) return;
    }
    markComplete(2);
    setStep(3);
  }

  function placeOrder() {
    // Re-validate everything: the shopper could have jumped back and emptied a
    // field, and this is the last gate before an order exists.
    const addrErrs = validateAddress(address);
    if (hasErrors(addrErrs)) {
      setAddressErrors(addrErrs);
      setStep(1);
      return;
    }
    if (!paymentMethod) {
      setPaymentError("Select a payment method to continue.");
      setStep(2);
      return;
    }
    if (paymentMethod === "card") {
      const cErrs = validateCard(card);
      if (hasErrors(cErrs)) {
        setCardErrors(cErrs);
        setStep(2);
        return;
      }
    }
    if (active.length === 0) return;

    setPlacing(true);
    const digits = card.number.replace(/\D/g, "");
    const order: Order = {
      id: generateOrderId(),
      placedAt: new Date().toISOString(),
      deliveryDate: delivery.date.toISOString(),
      items: toOrderItems(resolved),
      address,
      payment:
        paymentMethod === "card"
          ? { method: "card", brand: cardBrand(card.number), last4: digits.slice(-4) }
          : { method: "on-delivery" },
      totals,
      simulated: true,
    };

    addOrder(order);
    clearCart();
    reset();
    router.push(`/order-confirmation/${order.id}`);
  }

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-8 sm:py-10">
      <h1 className="mb-8 font-display text-display-lg font-medium text-ink">Checkout</h1>
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-14">
        <div className="min-w-0 flex-1">
          {/* ---------- 1. delivery ---------- */}
          <CheckoutStepPanel
            number={1}
            title="Delivery address"
            state={step === 1 ? "active" : completed.includes(1) ? "complete" : "upcoming"}
            onEdit={() => setStep(1)}
            summary={
              <span>
                {address.fullName}, {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}, {address.city} {address.state}{" "}
                {address.zip}
              </span>
            }
          >
            <form onSubmit={submitAddress} noValidate className="space-y-3">
              <Field label="Full name" htmlFor="fullName" required error={addressErrors.fullName}>
                <Input
                  id="fullName"
                  value={address.fullName}
                  onChange={(e) => setAddress({ fullName: e.target.value })}
                  invalid={!!addressErrors.fullName}
                  autoComplete="name"
                />
              </Field>

              <Field label="Street address" htmlFor="line1" required error={addressErrors.line1}>
                <Input
                  id="line1"
                  value={address.line1}
                  onChange={(e) => setAddress({ line1: e.target.value })}
                  invalid={!!addressErrors.line1}
                  placeholder="123 Market Street"
                  autoComplete="address-line1"
                />
              </Field>

              <Field label="Apartment, suite (optional)" htmlFor="line2">
                <Input
                  id="line2"
                  value={address.line2 ?? ""}
                  onChange={(e) => setAddress({ line2: e.target.value })}
                  autoComplete="address-line2"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="City" htmlFor="city" required error={addressErrors.city}>
                  <Input
                    id="city"
                    value={address.city}
                    onChange={(e) => setAddress({ city: e.target.value })}
                    invalid={!!addressErrors.city}
                    autoComplete="address-level2"
                  />
                </Field>

                <Field label="State" htmlFor="state" required error={addressErrors.state}>
                  <Select
                    id="state"
                    value={address.state}
                    onChange={(e) => setAddress({ state: e.target.value })}
                    invalid={!!addressErrors.state}
                  >
                    <option value="">Choose</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="ZIP code" htmlFor="zip" required error={addressErrors.zip}>
                  <Input
                    id="zip"
                    value={address.zip}
                    onChange={(e) => setAddress({ zip: e.target.value })}
                    invalid={!!addressErrors.zip}
                    inputMode="numeric"
                    placeholder="94103"
                    autoComplete="postal-code"
                  />
                </Field>
              </div>

              <Field label="Phone number" htmlFor="phone" required error={addressErrors.phone} hint="For delivery updates only.">
                <Input
                  id="phone"
                  value={address.phone}
                  onChange={(e) => setAddress({ phone: e.target.value })}
                  invalid={!!addressErrors.phone}
                  inputMode="tel"
                  placeholder="(555) 019 2837"
                  autoComplete="tel"
                />
              </Field>

              <Button type="submit" variant="primary" size="md">
                Use this address
              </Button>
            </form>
          </CheckoutStepPanel>

          {/* ---------- 2. payment ---------- */}
          <CheckoutStepPanel
            number={2}
            title="Payment method"
            state={step === 2 ? "active" : completed.includes(2) ? "complete" : "upcoming"}
            onEdit={() => setStep(2)}
            summary={
              paymentMethod === "card" ? (
                <span>
                  {cardBrand(card.number)} ending in {card.number.replace(/\D/g, "").slice(-4) || "••••"}{" "}
                  (simulated)
                </span>
              ) : (
                <span>Pay on delivery</span>
              )
            }
          >
            <form onSubmit={submitPayment} noValidate className="space-y-4">
              <div className="rounded-[var(--radius-sm)] border border-line bg-surface-sunk px-3 py-2 text-body-sm text-ink-2">
                <strong>Simulated payment.</strong> Nothing is charged and no card details are
                transmitted or stored. Use <code className="font-mono">4242 4242 4242 4242</code> to
                try it.
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-body font-medium text-ink">Choose how to pay</legend>

                <PaymentOption
                  checked={paymentMethod === "card"}
                  onSelect={() => {
                    setPaymentMethod("card");
                    setPaymentError("");
                  }}
                  icon={<CreditCard className="h-5 w-5 text-ink-3" />}
                  title="Credit or debit card"
                  subtitle="Simulated - no real card is charged"
                />

                <PaymentOption
                  checked={paymentMethod === "on-delivery"}
                  onSelect={() => {
                    setPaymentMethod("on-delivery");
                    setPaymentError("");
                  }}
                  icon={<Truck className="h-5 w-5 text-ink-3" />}
                  title="Pay on delivery"
                  subtitle="Settle up when the order arrives"
                />

                {paymentError && (
                  <p role="alert" className="text-body-sm text-accent">
                    {paymentError}
                  </p>
                )}
              </fieldset>

              {paymentMethod === "card" && (
                <div className="space-y-3 rounded-[var(--radius-sm)] border border-line bg-surface-sunk p-4">
                  <Field label="Card number" htmlFor="cardNumber" required error={cardErrors.number}>
                    <Input
                      id="cardNumber"
                      value={card.number}
                      onChange={(e) => setCard({ number: e.target.value })}
                      invalid={!!cardErrors.number}
                      inputMode="numeric"
                      placeholder="4242 4242 4242 4242"
                      maxLength={23}
                    />
                  </Field>

                  <Field label="Name on card" htmlFor="cardName" required error={cardErrors.name}>
                    <Input
                      id="cardName"
                      value={card.name}
                      onChange={(e) => setCard({ name: e.target.value })}
                      invalid={!!cardErrors.name}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expiry (MM/YY)" htmlFor="cardExpiry" required error={cardErrors.expiry}>
                      <Input
                        id="cardExpiry"
                        value={card.expiry}
                        onChange={(e) => setCard({ expiry: e.target.value })}
                        invalid={!!cardErrors.expiry}
                        placeholder="04/29"
                        maxLength={5}
                      />
                    </Field>

                    <Field label="Security code" htmlFor="cardCvv" required error={cardErrors.cvv}>
                      <Input
                        id="cardCvv"
                        value={card.cvv}
                        onChange={(e) => setCard({ cvv: e.target.value })}
                        invalid={!!cardErrors.cvv}
                        inputMode="numeric"
                        placeholder="123"
                        maxLength={4}
                      />
                    </Field>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary" size="md">
                  Use this payment method
                </Button>
                <Button type="button" variant="subtle" size="sm" onClick={() => setStep(1)}>
                  Back to delivery
                </Button>
              </div>
            </form>
          </CheckoutStepPanel>

          {/* ---------- 3. review ---------- */}
          <CheckoutStepPanel
            number={3}
            title="Review items and delivery"
            state={step === 3 ? "active" : completed.includes(3) ? "complete" : "upcoming"}
          >
            <div className="space-y-4">
              <div className="rounded-[var(--radius-sm)] border border-line p-4">
                <p className="text-body font-medium text-ink">
                  Estimated delivery: <span className="text-success">{delivery.long}</span>
                </p>
              </div>

              <ul className="divide-y divide-line-soft">
                {active.map((r) => (
                  <li key={`${r.line.productId}-${r.line.variantId ?? "base"}`} className="flex gap-3 py-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-line bg-surface-sunk">
                      {r.product.image && (
                        <Image src={r.product.image} alt={r.product.title} fill sizes="64px" className="object-contain" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="clamp-2 text-body-sm leading-[18px] text-ink">{r.product.title}</p>
                      {r.variantLabel && <p className="text-body-sm text-ink-3">{r.variantLabel}</p>}
                      <p className="tnum text-body-sm text-ink-3">Qty: {r.line.qty}</p>
                    </div>
                    <p className="tnum shrink-0 text-body font-semibold text-ink">{formatPrice(r.lineTotal)}</p>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" onClick={placeOrder} loading={placing}>
                  Place your order
                </Button>
                <Button type="button" variant="subtle" size="sm" onClick={() => setStep(2)}>
                  Back to payment
                </Button>
              </div>

              <p className="text-body-sm text-ink-3">
                By placing this order you are creating a simulated order in this demo. Nothing ships
                and nothing is charged.
              </p>
            </div>
          </CheckoutStepPanel>
        </div>

        {/* ---------- summary rail ---------- */}
        <aside className="w-full lg:sticky lg:top-[24px] lg:w-[340px] lg:shrink-0">
          <div
            data-testid={TID.checkoutSummary}
            className="rounded-[var(--radius-md)] border border-line bg-surface p-5"
          >
            <h2 className="font-display text-display-sm font-medium text-ink">Order summary</h2>

            <dl className="mt-4 flex flex-col gap-[10px] text-body">
              <Row label={`Items (${totals.itemCount})`} value={formatPrice(totals.subtotal)} />
              <Row
                label="Shipping"
                value={totals.freeShipping ? "Free" : formatPrice(totals.shipping)}
                accent={totals.freeShipping}
                testId={TID.checkoutShipping}
              />
              <Row label="Estimated tax" value={formatPrice(totals.tax)} testId={TID.checkoutTax} />
              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                <dt className="text-body-lg font-medium text-ink">Total</dt>
                <dd className="tnum text-display-sm font-semibold text-ink" data-testid={TID.orderTotal}>
                  {formatPrice(totals.total)}
                </dd>
              </div>
            </dl>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-5"
              onClick={placeOrder}
              disabled={step !== 3}
              loading={placing}
              data-testid={TID.placeOrder}
            >
              Place your order
            </Button>
            {step !== 3 && (
              <p className="mt-2 text-center text-body-sm text-ink-3">
                Complete the steps above to place your order.
              </p>
            )}
          </div>

          <Link
            href="/cart"
            className="mt-4 block text-center text-body-sm font-medium text-brand hover:underline"
          >
            Back to cart
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  testId,
}: {
  label: string;
  value: string;
  accent?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-2">{label}</dt>
      <dd data-testid={testId} className={accent ? "font-medium text-success" : "tnum text-ink"}>
        {value}
      </dd>
    </div>
  );
}

function PaymentOption({
  checked,
  onSelect,
  icon,
  title,
  subtitle,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-[10px] transition-colors ${
        checked ? "border-brand bg-brand-tint" : "border-line-strong hover:bg-surface-sunk"
      }`}
    >
      <input
        type="radio"
        name="paymentMethod"
        checked={checked}
        onChange={onSelect}
        className="h-4 w-4 accent-[#007185]"
      />
      {icon}
      <span className="min-w-0">
        <span className="block text-body font-medium text-ink">{title}</span>
        <span className="block text-body-sm text-ink-3">{subtitle}</span>
      </span>
    </label>
  );
}

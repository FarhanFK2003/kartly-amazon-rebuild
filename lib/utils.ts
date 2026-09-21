import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * How money is presented, in one place.
 *
 * Presentation only. Kartly prices everything in a single currency and there is
 * no conversion, no rates service and no external call - so the symbol, the
 * grouping locale and the code all come from here, and the header's locale
 * control reports this rather than implying a conversion that does not happen.
 *
 * The symbol used to be written inline in both formatters, which is how a store
 * ends up with one currency on a product card and another in a total.
 */
export const CURRENCY = {
  code: "USD",
  symbol: "$",
  locale: "en-US",
  label: "US Dollar",
} as const;

/**
 * Amazon splits a price into a small raised currency symbol, a large whole
 * part and small raised decimals. Rendering it any other way is the fastest
 * way to look like a knock-off, so every price goes through this.
 */
export function splitPrice(cents: number) {
  const whole = Math.floor(Math.abs(cents) / 100);
  const fraction = String(Math.abs(cents) % 100).padStart(2, "0");
  return {
    symbol: CURRENCY.symbol,
    whole: whole.toLocaleString(CURRENCY.locale),
    fraction,
    negative: cents < 0,
  };
}

/** Flat string form, for summaries and totals. */
export function formatPrice(cents: number) {
  return `${CURRENCY.symbol}${(cents / 100).toLocaleString(CURRENCY.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Prose form of a price: drops the decimals when the amount is whole.
 *
 * Totals and line prices always want two decimals - a subtotal reading "$39.9"
 * looks broken. Sentences do not: "free delivery over $35.00" reads like an
 * invoice, not an offer. Same currency definition, different register.
 */
export function formatPriceShort(cents: number) {
  return cents % 100 === 0
    ? `${CURRENCY.symbol}${Math.round(cents / 100).toLocaleString(CURRENCY.locale)}`
    : formatPrice(cents);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Delivery promises are computed from the real current date, so the store never
 * shows a stale or impossible date.
 */
export function deliveryDate(daysFromNow: number, from: Date = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + daysFromNow);
  return {
    date: d,
    long: `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`,
    short: `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`,
  };
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return n === 1 ? one : many;
}

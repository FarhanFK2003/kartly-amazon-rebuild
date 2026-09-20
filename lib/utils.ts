import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Amazon splits a price into a small raised currency symbol, a large whole
 * part and small raised decimals. Rendering it any other way is the fastest
 * way to look like a knock-off, so every price goes through this.
 */
export function splitPrice(cents: number) {
  const whole = Math.floor(Math.abs(cents) / 100);
  const fraction = String(Math.abs(cents) % 100).padStart(2, "0");
  return {
    symbol: "$",
    whole: whole.toLocaleString("en-US"),
    fraction,
    negative: cents < 0,
  };
}

/** Flat string form, for summaries and totals. */
export function formatPrice(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

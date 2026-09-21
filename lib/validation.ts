import type { OrderAddress } from "./commerce";
import type { CardDraft } from "./store/checkout";

export type Errors<T> = Partial<Record<keyof T, string>>;

/*
  Hand-rolled rather than relying on the browser's native form validation, so
  the messages are ours, appear inline next to the field, and behave the same
  in every browser. Forms carry noValidate for the same reason.
*/

export function validateAddress(a: OrderAddress): Errors<OrderAddress> {
  const e: Errors<OrderAddress> = {};

  if (!a.fullName.trim()) e.fullName = "Enter a full name.";
  else if (a.fullName.trim().length < 2) e.fullName = "That name looks too short.";

  if (!a.line1.trim()) e.line1 = "Enter a street address.";
  else if (a.line1.trim().length < 4) e.line1 = "Enter a complete street address.";

  if (!a.city.trim()) e.city = "Enter a city.";
  if (!a.state.trim()) e.state = "Select a state.";

  if (!a.zip.trim()) e.zip = "Enter a ZIP code.";
  else if (!/^\d{5}(-\d{4})?$/.test(a.zip.trim())) e.zip = "Enter a 5-digit ZIP code, e.g. 94103.";

  const digits = a.phone.replace(/\D/g, "");
  if (!a.phone.trim()) e.phone = "Enter a phone number.";
  else if (digits.length < 10) e.phone = "Enter a 10-digit phone number.";

  return e;
}

/** Standard Luhn check. Catches transposed digits, which a length check cannot. */
export function luhn(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function cardBrand(number: string): string {
  const d = number.replace(/\D/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^6(?:011|5)/.test(d)) return "Discover";
  return "Card";
}

export function validateCard(c: CardDraft): Errors<CardDraft> {
  const e: Errors<CardDraft> = {};
  const digits = c.number.replace(/\D/g, "");

  if (!digits) e.number = "Enter a card number.";
  else if (digits.length < 13) e.number = "That card number is too short.";
  else if (!luhn(c.number)) e.number = "That card number is not valid. Try 4242 4242 4242 4242.";

  if (!c.name.trim()) e.name = "Enter the name on the card.";

  if (!c.expiry.trim()) e.expiry = "Enter an expiry date.";
  else if (!/^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/.test(c.expiry.trim())) e.expiry = "Use MM/YY format.";
  else {
    const [mm, yy] = c.expiry.split("/").map((s) => Number(s.trim()));
    // Compare against the last day of the expiry month.
    const expires = new Date(2000 + yy, mm, 0, 23, 59, 59);
    if (expires.getTime() < Date.now()) e.expiry = "That card has expired.";
  }

  if (!c.cvv.trim()) e.cvv = "Enter the security code.";
  else if (!/^\d{3,4}$/.test(c.cvv.trim())) e.cvv = "The security code is 3 or 4 digits.";

  return e;
}

export const hasErrors = (e: object) => Object.keys(e).length > 0;

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC",
];

/* ---------- simulated sign-in ---------- */

export interface CredentialsDraft {
  identifier: string;
  password: string;
  name: string;
}

/**
 * Shape checks only. Nothing is authenticated and the password is never stored
 * or transmitted - this exists so the form behaves like a real one.
 */
export function validateCredentials(
  c: CredentialsDraft,
  mode: "signin" | "register"
): Errors<CredentialsDraft> {
  const e: Errors<CredentialsDraft> = {};
  const id = c.identifier.trim();
  const digits = id.replace(/\D/g, "");

  if (!id) {
    e.identifier = "Enter your email or mobile phone number.";
  } else if (id.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(id)) e.identifier = "Enter a valid email address.";
  } else if (digits.length < 10) {
    e.identifier = "Enter a valid email address or a 10-digit phone number.";
  }

  if (!c.password) e.password = "Enter your password.";
  else if (c.password.length < 6) e.password = "Passwords must be at least 6 characters.";

  if (mode === "register" && !c.name.trim()) e.name = "Enter your name.";

  return e;
}

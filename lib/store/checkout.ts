"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OrderAddress, OrderPayment } from "@/lib/commerce";

export type CheckoutStep = 1 | 2 | 3;

export interface CardDraft {
  /** Simulated. Never sent anywhere; only the last four are ever retained. */
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}

interface CheckoutState {
  step: CheckoutStep;
  address: OrderAddress;
  paymentMethod: OrderPayment["method"] | null;
  card: CardDraft;
  /** Steps the shopper has completed, so they can jump back and forth. */
  completed: CheckoutStep[];
  setStep: (step: CheckoutStep) => void;
  setAddress: (patch: Partial<OrderAddress>) => void;
  setPaymentMethod: (method: OrderPayment["method"] | null) => void;
  setCard: (patch: Partial<CardDraft>) => void;
  markComplete: (step: CheckoutStep) => void;
  reset: () => void;
}

const EMPTY_ADDRESS: OrderAddress = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
};

const EMPTY_CARD: CardDraft = { number: "", name: "", expiry: "", cvv: "" };

/**
 * Checkout progress is persisted so a refresh mid-flow does not throw the
 * shopper back to an empty form. The card draft is deliberately part of that
 * persistence only for the duration of the flow, and is wiped by reset() the
 * moment an order is placed - only the last four digits survive, on the order.
 */
export const useCheckout = create<CheckoutState>()(
  persist(
    (set) => ({
      step: 1,
      address: EMPTY_ADDRESS,
      paymentMethod: null,
      card: EMPTY_CARD,
      completed: [],

      setStep: (step) => set({ step }),
      setAddress: (patch) => set((s) => ({ address: { ...s.address, ...patch } })),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setCard: (patch) => set((s) => ({ card: { ...s.card, ...patch } })),
      markComplete: (step) =>
        set((s) => ({ completed: s.completed.includes(step) ? s.completed : [...s.completed, step] })),

      reset: () => set({ step: 1, address: EMPTY_ADDRESS, paymentMethod: null, card: EMPTY_CARD, completed: [] }),
    }),
    {
      name: "kartly.checkout",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        step: state.step,
        address: state.address,
        paymentMethod: state.paymentMethod,
        completed: state.completed,
        // The card draft is intentionally excluded from persistence.
        card: EMPTY_CARD,
      }),
    }
  )
);

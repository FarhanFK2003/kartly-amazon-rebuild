"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Order } from "@/lib/commerce";

interface OrdersState {
  orders: Order[];
  addOrder: (order: Order) => void;
  getOrder: (id: string) => Order | undefined;
}

/**
 * Completed orders, newest first.
 *
 * P1 will expose these at /orders; for now the store simply keeps them in a
 * structured, versioned-by-shape form so that page is a read away. Nothing here
 * is a real order and no payment is ever processed.
 */
export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
      getOrder: (id) => get().orders.find((o) => o.id === id),
    }),
    {
      name: "kartly.orders",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ orders: state.orders }),
    }
  )
);

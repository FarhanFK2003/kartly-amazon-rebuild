"use client";

import { create } from "zustand";

interface CartDrawerState {
  open: boolean;
  /** The line most recently added, so the drawer can point at it briefly. */
  highlightId: string | null;
  openDrawer: (highlightId?: string | null) => void;
  closeDrawer: () => void;
}

/**
 * Open state for the mini-cart.
 *
 * Same shape as the department drawer's store and for the same reason: the
 * drawer exists once in the DOM, but it is opened from every add-to-cart
 * control in the app - listing cards, the buy box, frequently-bought-together.
 * Threading a callback down to all of them would mean prop-drilling through
 * server components that have no business knowing about a drawer.
 *
 * highlightId carries the product that triggered the open so the drawer can
 * mark that one row as just-added. It is display state, not cart state, which
 * is why it lives here and not in the persisted cart.
 */
export const useCartDrawer = create<CartDrawerState>((set) => ({
  open: false,
  highlightId: null,
  openDrawer: (highlightId = null) => set({ open: true, highlightId }),
  closeDrawer: () => set({ open: false }),
}));

/**
 * How long an add-to-cart control shows its confirmation.
 *
 * The listing button used 1400ms and the buy box used 1600ms with a different
 * label, so the same action confirmed itself two ways depending on where it was
 * clicked. One number, one label, everywhere.
 */
export const ADD_FEEDBACK_MS = 1400;
